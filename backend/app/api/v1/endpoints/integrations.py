from datetime import datetime
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel, HttpUrl
from enum import Enum

from app.api.deps import get_current_user, get_db
from app.models.user import User
from app.models.bot import Bot

router = APIRouter()


class IntegrationType(str, Enum):
    TELEGRAM = "telegram"
    SLACK = "slack"
    WHATSAPP = "whatsapp"
    ZALO = "zalo"
    WEBSITE = "website"
    API = "api"


class IntegrationStatus(str, Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"
    ERROR = "error"


# Schemas
class IntegrationCreate(BaseModel):
    bot_id: str
    type: IntegrationType
    config: Dict[str, Any]
    name: Optional[str] = None


class IntegrationUpdate(BaseModel):
    config: Optional[Dict[str, Any]] = None
    is_active: Optional[bool] = None
    name: Optional[str] = None


class IntegrationResponse(BaseModel):
    id: str
    bot_id: str
    bot_name: str
    type: IntegrationType
    name: str
    config: Dict[str, Any]
    status: IntegrationStatus
    is_active: bool
    created_at: datetime
    updated_at: datetime


@router.get("/")
async def list_integrations(
    bot_id: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    List all integrations for the current tenant.
    Optionally filter by bot_id.
    """
    from app.db.mongodb import get_mongodb
    
    mongo_db = await get_mongodb()
    integrations_collection = mongo_db.integrations
    
    # Build query
    query = {"tenant_id": str(current_user.tenant_id)}
    if bot_id:
        # Verify bot belongs to tenant
        bot = db.query(Bot).filter(
            Bot.id == bot_id,
            Bot.tenant_id == current_user.tenant_id
        ).first()
        if not bot:
            raise HTTPException(status_code=404, detail="Bot not found")
        query["bot_id"] = bot_id
    
    # Get all tenant bots for mapping
    bots = db.query(Bot).filter(Bot.tenant_id == current_user.tenant_id).all()
    bot_map = {str(bot.id): bot.name for bot in bots}
    
    # Fetch integrations
    integrations = await integrations_collection.find(query).to_list(None)
    
    return [
        {
            "id": str(integration["_id"]),
            "bot_id": integration.get("bot_id"),
            "bot_name": bot_map.get(integration.get("bot_id"), "Unknown"),
            "type": integration.get("type"),
            "name": integration.get("name"),
            "config": integration.get("config", {}),
            "status": integration.get("status", "inactive"),
            "is_active": integration.get("is_active", False),
            "created_at": integration.get("created_at"),
            "updated_at": integration.get("updated_at"),
        }
        for integration in integrations
    ]


@router.post("/")
async def create_integration(
    integration_data: IntegrationCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Create a new integration for a bot.
    """
    from app.db.mongodb import get_mongodb
    
    # Verify bot belongs to tenant
    bot = db.query(Bot).filter(
        Bot.id == integration_data.bot_id,
        Bot.tenant_id == current_user.tenant_id
    ).first()
    if not bot:
        raise HTTPException(status_code=404, detail="Bot not found")
    
    # Validate config based on integration type
    _validate_integration_config(integration_data.type, integration_data.config)
    
    mongo_db = await get_mongodb()
    integrations_collection = mongo_db.integrations
    
    # Check for duplicate integration
    existing = await integrations_collection.find_one({
        "bot_id": integration_data.bot_id,
        "type": integration_data.type
    })
    if existing:
        raise HTTPException(
            status_code=400,
            detail=f"Integration of type {integration_data.type} already exists for this bot"
        )
    
    # Create integration
    integration_doc = {
        "bot_id": integration_data.bot_id,
        "tenant_id": str(current_user.tenant_id),
        "type": integration_data.type,
        "name": integration_data.name or f"{bot.name} - {integration_data.type}",
        "config": integration_data.config,
        "status": "inactive",
        "is_active": True,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
    }
    
    result = await integrations_collection.insert_one(integration_doc)
    integration_doc["id"] = str(result.inserted_id)
    
    return {
        **integration_doc,
        "bot_name": bot.name,
        "message": "Integration created successfully"
    }


@router.get("/{integration_id}")
async def get_integration(
    integration_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Get a specific integration by ID.
    """
    from app.db.mongodb import get_mongodb
    from bson import ObjectId
    
    mongo_db = await get_mongodb()
    integrations_collection = mongo_db.integrations
    
    integration = await integrations_collection.find_one({
        "_id": ObjectId(integration_id),
        "tenant_id": str(current_user.tenant_id)
    })
    
    if not integration:
        raise HTTPException(status_code=404, detail="Integration not found")
    
    # Get bot name
    bot = db.query(Bot).filter(Bot.id == integration["bot_id"]).first()
    
    return {
        "id": str(integration["_id"]),
        "bot_id": integration.get("bot_id"),
        "bot_name": bot.name if bot else "Unknown",
        "type": integration.get("type"),
        "name": integration.get("name"),
        "config": integration.get("config", {}),
        "status": integration.get("status"),
        "is_active": integration.get("is_active"),
        "created_at": integration.get("created_at"),
        "updated_at": integration.get("updated_at"),
    }


@router.put("/{integration_id}")
async def update_integration(
    integration_id: str,
    integration_update: IntegrationUpdate,
    current_user: User = Depends(get_current_user),
):
    """
    Update an integration's configuration.
    """
    from app.db.mongodb import get_mongodb
    from bson import ObjectId
    
    mongo_db = await get_mongodb()
    integrations_collection = mongo_db.integrations
    
    # Verify integration belongs to tenant
    integration = await integrations_collection.find_one({
        "_id": ObjectId(integration_id),
        "tenant_id": str(current_user.tenant_id)
    })
    
    if not integration:
        raise HTTPException(status_code=404, detail="Integration not found")
    
    # Build update
    update_data = {"updated_at": datetime.utcnow()}
    if integration_update.config is not None:
        _validate_integration_config(integration["type"], integration_update.config)
        update_data["config"] = integration_update.config
    if integration_update.is_active is not None:
        update_data["is_active"] = integration_update.is_active
        update_data["status"] = "active" if integration_update.is_active else "inactive"
    if integration_update.name is not None:
        update_data["name"] = integration_update.name
    
    # Update
    await integrations_collection.update_one(
        {"_id": ObjectId(integration_id)},
        {"$set": update_data}
    )
    
    return {"message": "Integration updated successfully"}


@router.delete("/{integration_id}")
async def delete_integration(
    integration_id: str,
    current_user: User = Depends(get_current_user),
):
    """
    Delete an integration.
    """
    from app.db.mongodb import get_mongodb
    from bson import ObjectId
    
    mongo_db = await get_mongodb()
    integrations_collection = mongo_db.integrations
    
    result = await integrations_collection.delete_one({
        "_id": ObjectId(integration_id),
        "tenant_id": str(current_user.tenant_id)
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Integration not found")
    
    return {"message": "Integration deleted successfully"}


@router.post("/{integration_id}/test")
async def test_integration(
    integration_id: str,
    current_user: User = Depends(get_current_user),
):
    """
    Test an integration connection.
    """
    from app.db.mongodb import get_mongodb
    from bson import ObjectId
    
    mongo_db = await get_mongodb()
    integrations_collection = mongo_db.integrations
    
    integration = await integrations_collection.find_one({
        "_id": ObjectId(integration_id),
        "tenant_id": str(current_user.tenant_id)
    })
    
    if not integration:
        raise HTTPException(status_code=404, detail="Integration not found")
    
    # TODO: Implement actual testing logic per integration type
    # For now, return a mock success
    return {
        "success": True,
        "message": f"Integration test successful for {integration['type']}",
        "details": {
            "type": integration["type"],
            "status": "connected"
        }
    }


def _validate_integration_config(integration_type: IntegrationType, config: Dict[str, Any]):
    """
    Validate integration config based on type.
    """
    if integration_type == IntegrationType.TELEGRAM:
        if "bot_token" not in config:
            raise HTTPException(status_code=400, detail="Telegram integration requires 'bot_token'")
    
    elif integration_type == IntegrationType.SLACK:
        if "bot_token" not in config or "signing_secret" not in config:
            raise HTTPException(
                status_code=400,
                detail="Slack integration requires 'bot_token' and 'signing_secret'"
            )
    
    elif integration_type == IntegrationType.WHATSAPP:
        if "phone_number_id" not in config or "access_token" not in config:
            raise HTTPException(
                status_code=400,
                detail="WhatsApp integration requires 'phone_number_id' and 'access_token'"
            )
    
    elif integration_type == IntegrationType.WEBSITE:
        # Website widget just needs styling config
        pass
    
    elif integration_type == IntegrationType.API:
        # API integration uses the bot's API key
        pass
