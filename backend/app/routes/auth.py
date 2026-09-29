import hashlib
import hmac
import secrets
import json
import base64
from datetime import datetime, timedelta
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Header, status
from sqlalchemy.orm import Session
from backend.app.config import settings
from backend.app.database.session import get_db
from backend.app.models.models import User, UserSession
from backend.app.schemas.schemas import (
    LoginRequest, TokenResponse, UserResponse, ChangePasswordRequest
)
from backend.app.services.audit_service import record_audit_log

auth_router = APIRouter(prefix="/api/auth", tags=["Authentication"])


def hash_password(password: str, salt: Optional[str] = None) -> str:
    """Hash password using PBKDF2-HMAC-SHA256 with random salt."""
    if not salt:
        salt = secrets.token_hex(16)
    hashed = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt.encode("utf-8"),
        100000
    ).hex()
    return f"{salt}${hashed}"


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify password against stored salt$hash securely."""
    try:
        parts = hashed_password.split("$")
        if len(parts) != 2:
            return False
        salt, _ = parts
        expected = hash_password(plain_password, salt)
        return hmac.compare_digest(expected, hashed_password)
    except Exception:
        return False


def generate_token(user: User) -> str:
    """Generate a signed Bearer token with expiration payload."""
    expires = datetime.utcnow() + timedelta(minutes=settings.SESSION_DURATION_MINUTES)
    payload = {
        "sub": str(user.id),
        "email": user.email,
        "name": user.name,
        "role": user.role,
        "jti": secrets.token_hex(8),
        "exp": int(expires.timestamp())
    }
    payload_str = base64.urlsafe_b64encode(json.dumps(payload).encode()).decode()
    signature = hmac.new(settings.SECRET_KEY.encode(), payload_str.encode(), hashlib.sha256).hexdigest()
    return f"{payload_str}.{signature}"


def verify_token(token: str) -> Optional[dict]:
    """Verify token signature and expiration."""
    try:
        parts = token.split(".")
        if len(parts) != 2:
            return None
        payload_str, signature = parts
        expected_sig = hmac.new(settings.SECRET_KEY.encode(), payload_str.encode(), hashlib.sha256).hexdigest()
        if not hmac.compare_digest(expected_sig, signature):
            return None
        payload = json.loads(base64.urlsafe_b64decode(payload_str.encode()).decode())
        if payload.get("exp", 0) < int(datetime.utcnow().timestamp()):
            return None
        return payload
    except Exception:
        return None


def get_current_user(
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db)
) -> User:
    """Dependency to extract authenticated user from Bearer header."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required. Please provide a valid Bearer token."
        )
    token = authorization.split(" ")[1]
    payload = verify_token(token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session expired or invalid token. Please login again."
        )
    user_id = int(payload.get("sub", 0))
    user = db.query(User).filter(User.id == user_id).first()
    if not user or user.status != "ACTIVE":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User account is inactive or disabled."
        )
    return user


def get_optional_current_user(
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db)
) -> Optional[User]:
    """Dependency to extract user if Bearer token present, else return None without raising 401."""
    if not authorization or not authorization.startswith("Bearer "):
        return None
    try:
        token = authorization.split(" ")[1]
        payload = verify_token(token)
        if not payload:
            return None
        user_id = int(payload.get("sub", 0))
        user = db.query(User).filter(User.id == user_id).first()
        return user if (user and user.status == "ACTIVE") else None
    except Exception:
        return None


# Reusable Authorization Dependencies (RBAC)
def require_roles(*allowed_roles: str):
    """Factory dependency for role-based authorization."""
    def role_dependency(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role != "ADMIN" and current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access Denied: Requires one of roles: {', '.join(allowed_roles)}. Your role is {current_user.role}."
            )
        return current_user
    return role_dependency


def require_admin(user: User = Depends(get_current_user)) -> User:
    """Admin-only dependency."""
    if user.role != "ADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access Denied: Administrator privileges required."
        )
    return user


def require_devops(user: User = Depends(get_current_user)) -> User:
    """DevOps or Admin privileges required."""
    if user.role not in ["DEVOPS", "ADMIN"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access Denied: DevOps privileges required."
        )
    return user


def require_release_manager(user: User = Depends(get_current_user)) -> User:
    """Release Manager or Admin privileges required."""
    if user.role not in ["RELEASE_MANAGER", "ADMIN"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access Denied: Release Manager privileges required."
        )
    return user


def require_developer(user: User = Depends(get_current_user)) -> User:
    """Developer, DevOps, or Admin privileges required."""
    if user.role not in ["DEVELOPER", "DEVOPS", "ADMIN"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access Denied: Developer privileges required."
        )
    return user


def require_auditor(user: User = Depends(get_current_user)) -> User:
    """Auditor, Admin, or any verified role can view audit reports."""
    allowed = ["AUDITOR", "ADMIN", "DEVOPS", "DEVELOPER", "RELEASE_MANAGER"]
    if user.role not in allowed:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access Denied: Auditor privileges required."
        )
    return user


def seed_demo_users(db: Session):
    """Seed predefined local development demo users with hashed passwords."""
    demo_accounts = [
        ("Admin User", "admin@example.com", "admin123", "ADMIN"),
        ("Senior Developer", "developer@example.com", "dev123", "DEVELOPER"),
        ("Lead DevOps", "devops@example.com", "devops123", "DEVOPS"),
        ("Release Manager", "release@example.com", "release123", "RELEASE_MANAGER"),
        ("Compliance Auditor", "auditor@example.com", "audit123", "AUDITOR"),
    ]
    for name, email, password, role in demo_accounts:
        existing = db.query(User).filter(User.email == email).first()
        if not existing:
            new_user = User(
                name=name,
                email=email,
                hashed_password=hash_password(password),
                role=role,
                status="ACTIVE",
                last_login=datetime.utcnow()
            )
            db.add(new_user)
        else:
            # Ensure role is canonical if it changed
            if existing.role != role:
                existing.role = role
    db.commit()


@auth_router.post("/login", response_model=TokenResponse)
def login(request: LoginRequest, db: Session = Depends(get_db)):
    """Authenticate user with email and password, issuing a signed bearer session token."""
    seed_demo_users(db)

    user = db.query(User).filter(User.email == request.email.lower().strip()).first()
    if not user or not verify_password(request.password, user.hashed_password):
        # Audit log failed login
        record_audit_log(
            db=db,
            action="AUTH_LOGIN_FAILED",
            user=request.email.strip(),
            decision="BLOCKED",
            reason="Invalid credentials supplied during login attempt."
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )

    if user.status != "ACTIVE":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is disabled. Contact system administrator."
        )

    # Generate token
    token = generate_token(user)
    user.last_login = datetime.utcnow()

    # Create active session record
    expires_at = datetime.utcnow() + timedelta(
        minutes=settings.SESSION_DURATION_MINUTES * (48 if request.remember_me else 1)
    )
    session_record = UserSession(
        user_id=user.id,
        token=token,
        expires_at=expires_at,
        is_active=True
    )
    db.add(session_record)

    # Audit log successful login
    record_audit_log(
        db=db,
        action="AUTH_LOGIN_SUCCESS",
        user=f"{user.name} ({user.email})",
        role=user.role,
        decision="APPROVED",
        reason=f"User authenticated successfully via role {user.role}."
    )

    return TokenResponse(
        access_token=token,
        token_type="bearer",
        expires_in=settings.SESSION_DURATION_MINUTES * 60,
        user=UserResponse.model_validate(user)
    )


@auth_router.post("/logout")
def logout(
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    """Terminate current user session."""
    user_identifier = "unknown_user"
    user_role = None

    if authorization and authorization.startswith("Bearer "):
        token = authorization.split(" ")[1]
        session_rec = db.query(UserSession).filter(UserSession.token == token).first()
        if session_rec:
            session_rec.is_active = False
            user = db.query(User).filter(User.id == session_rec.user_id).first()
            if user:
                user_identifier = f"{user.name} ({user.email})"
                user_role = user.role
            db.commit()

    record_audit_log(
        db=db,
        action="AUTH_LOGOUT",
        user=user_identifier,
        role=user_role,
        decision="APPROVED",
        reason="User logged out and terminated active session."
    )

    return {"message": "Logged out successfully"}


@auth_router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    """Retrieve currently authenticated user profile and active role."""
    return UserResponse.model_validate(current_user)


@auth_router.post("/refresh", response_model=TokenResponse)
def refresh_token(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Refresh active session token."""
    new_token = generate_token(current_user)
    session_record = UserSession(
        user_id=current_user.id,
        token=new_token,
        expires_at=datetime.utcnow() + timedelta(minutes=settings.SESSION_DURATION_MINUTES),
        is_active=True
    )
    db.add(session_record)
    db.commit()

    return TokenResponse(
        access_token=new_token,
        token_type="bearer",
        expires_in=settings.SESSION_DURATION_MINUTES * 60,
        user=UserResponse.model_validate(current_user)
    )


@auth_router.post("/change-password")
def change_password(
    req: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Allow authenticated user to change their password."""
    if not verify_password(req.current_password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect."
        )
    if req.new_password != req.confirm_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New password and confirm password do not match."
        )
    if len(req.new_password) < 6:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must be at least 6 characters long."
        )

    current_user.hashed_password = hash_password(req.new_password)
    record_audit_log(
        db=db,
        action="USER_PASSWORD_CHANGED",
        user=f"{current_user.name} ({current_user.email})",
        role=current_user.role,
        decision="APPROVED",
        reason="User updated their account password."
    )
    return {"message": "Password changed successfully"}
