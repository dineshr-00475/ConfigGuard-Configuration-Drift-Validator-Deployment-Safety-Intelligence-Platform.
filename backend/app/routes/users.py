from typing import List
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from backend.app.database.session import get_db
from backend.app.models.models import User, AuditLog
from backend.app.schemas.schemas import UserResponse, CreateUserRequest, UpdateUserRequest
from backend.app.routes.auth import get_current_user, hash_password, require_admin

users_router = APIRouter(prefix="/api/users", tags=["User Management"])


@users_router.get("", response_model=List[UserResponse])
def list_users(
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """List all registered users (Admin only)."""
    users = db.query(User).order_by(User.id.asc()).all()
    return [UserResponse.model_validate(u) for u in users]


@users_router.post("", response_model=UserResponse)
def create_user(
    req: CreateUserRequest,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Create a new user with specified role (Admin only)."""
    existing = db.query(User).filter(User.email == req.email.lower().strip()).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A user with this email address already exists."
        )

    valid_roles = ["ADMIN", "DEVELOPER", "DEVOPS", "RELEASE_MANAGER"]
    role = req.role.upper().strip()
    if role not in valid_roles:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid role. Allowed roles: {', '.join(valid_roles)}"
        )

    new_user = User(
        name=req.name.strip(),
        email=req.email.lower().strip(),
        hashed_password=hash_password(req.password),
        role=role,
        status=req.status.upper().strip(),
        created_at=datetime.utcnow()
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    audit = AuditLog(
        action="USER_CREATED",
        user=f"{admin.name} ({admin.email})",
        decision="APPROVED",
        reason=f"Created user {new_user.email} with role {new_user.role}."
    )
    db.add(audit)
    db.commit()

    return UserResponse.model_validate(new_user)


@users_router.put("/{user_id}", response_model=UserResponse)
def update_user(
    user_id: int,
    req: UpdateUserRequest,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Update user details or role (Admin only)."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    if req.name is not None:
        user.name = req.name.strip()
    if req.email is not None:
        user.email = req.email.lower().strip()
    if req.role is not None:
        user.role = req.role.upper().strip()
    if req.status is not None:
        user.status = req.status.upper().strip()

    audit = AuditLog(
        action="USER_UPDATED",
        user=f"{admin.name} ({admin.email})",
        decision="APPROVED",
        reason=f"Updated details for user {user.email}."
    )
    db.add(audit)
    db.commit()
    db.refresh(user)
    return UserResponse.model_validate(user)


@users_router.post("/{user_id}/toggle-status")
def toggle_user_status(
    user_id: int,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Enable or disable user account (Admin only)."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    if user.id == admin.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot disable your own active administrator account."
        )

    user.status = "DISABLED" if user.status == "ACTIVE" else "ACTIVE"
    audit = AuditLog(
        action="USER_STATUS_TOGGLED",
        user=f"{admin.name} ({admin.email})",
        decision="APPROVED",
        reason=f"Changed status of user {user.email} to {user.status}."
    )
    db.add(audit)
    db.commit()
    return {"message": f"User status updated to {user.status}", "status": user.status}


@users_router.post("/{user_id}/reset-password")
def reset_user_password(
    user_id: int,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Reset password to default temporary password 'Password@123' (Admin only)."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    temp_password = "Password@123"
    user.hashed_password = hash_password(temp_password)

    audit = AuditLog(
        action="USER_PASSWORD_RESET_BY_ADMIN",
        user=f"{admin.name} ({admin.email})",
        decision="APPROVED",
        reason=f"Admin reset temporary password for {user.email}."
    )
    db.add(audit)
    db.commit()
    return {"message": f"Password reset for {user.email}. Temporary password: {temp_password}"}
