from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
import uuid

from app.api import deps
from app.models.user import User
from app.models.bot import Bot as BotModel
from app.schemas.bot_template import BotTemplate, CreateBotFromTemplate, TemplateDomain
from app.schemas.bot import Bot
from app.services.bot_templates import (
    get_all_templates,
    get_templates_by_domain,
    get_template_by_id
)
import secrets

router = APIRouter()


@router.get("/", response_model=List[BotTemplate])
def list_templates():
    """Get all available bot templates"""
    return get_all_templates()


@router.get("/domains/{domain}", response_model=List[BotTemplate])
def list_templates_by_domain(domain: TemplateDomain):
    """Get templates filtered by domain (education, sales, legal)"""
    templates = get_templates_by_domain(domain)
    if not templates:
        raise HTTPException(status_code=404, detail=f"No templates found for domain: {domain}")
    return templates


@router.get("/{template_id}", response_model=BotTemplate)
def get_template(template_id: str):
    """Get a specific template by ID"""
    template = get_template_by_id(template_id)
    if not template:
        raise HTTPException(status_code=404, detail=f"Template not found: {template_id}")
    return template


@router.post("/create-from-template", response_model=Bot, status_code=201)
def create_bot_from_template(
    request: CreateBotFromTemplate,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
):
    """Create a new bot from a template"""
    # Get the template
    template = get_template_by_id(request.template_id)
    if not template:
        raise HTTPException(status_code=404, detail=f"Template not found: {request.template_id}")
    
    # Build bot configuration from template
    bot_config = {
        "welcome_message": template.welcome_message,
        "fallback_message": template.fallback_message,
        "temperature": template.temperature,
        "max_tokens": template.max_tokens,
        "personality": template.personality,
        "tone_formality": template.tone_formality,
        "verbosity": template.verbosity,
        "system_prompt": template.system_prompt,
        "template_id": template.id,
        "template_domain": template.domain,
        "features": template.features,
        "suggested_categories": template.suggested_categories,
        "sample_queries": template.sample_queries,
        "required_metadata_fields": template.required_metadata_fields,
    }
    
    # Apply any custom overrides
    if request.customize_config:
        bot_config.update(request.customize_config)
    
    # Create the bot
    bot = BotModel(
        id=uuid.uuid4(),
        tenant_id=current_user.tenant_id,
        name=request.name,
        description=request.description or template.description,
        config=bot_config,
        is_active=True,
        api_key=secrets.token_urlsafe(32),
    )
    
    db.add(bot)
    db.commit()
    db.refresh(bot)
    
    return bot
