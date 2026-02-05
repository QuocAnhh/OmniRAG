from typing import Any, List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_db, get_current_active_user
from app.models.tenant import Tenant
from app.models.user import User
from app.schemas.tenant import Tenant as TenantSchema, TenantUpdate

router = APIRouter()


@router.get("/me", response_model=TenantSchema)
def read_tenant_me(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> Any:
    """
    Get current user's tenant
    """
    tenant = db.query(Tenant).filter(Tenant.id == current_user.tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    return tenant


@router.put("/me", response_model=TenantSchema)
def update_tenant_me(
    *,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    tenant_in: TenantUpdate,
) -> Any:
    """
    Update current user's tenant (requires owner or admin role)
    """
    if current_user.role not in ["owner", "admin"]:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    
    tenant = db.query(Tenant).filter(Tenant.id == current_user.tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    
    # Update tenant
    update_data = tenant_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(tenant, field, value)
    
    db.add(tenant)
    db.commit()
    db.refresh(tenant)
    return tenant
