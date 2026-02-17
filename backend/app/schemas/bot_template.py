from pydantic import BaseModel
from typing import Optional, Dict, Any, List
from enum import Enum


class TemplateDomain(str, Enum):
    EDUCATION = "education"
    SALES = "sales"
    LEGAL = "legal"
    OTHER = "other"


class BotTemplate(BaseModel):
    """Bot template definition"""
    id: str
    name: str
    domain: TemplateDomain
    description: str
    icon: str  # Material icon name
    
    # Pre-configured settings
    system_prompt: str
    welcome_message: str
    fallback_message: str
    temperature: float = 0.7
    max_tokens: int = 2000
    
    # Domain-specific configuration
    personality: str = "professional"  # professional, friendly, technical, casual
    tone_formality: int = 5  # 1-10 scale
    verbosity: str = "balanced"  # concise, balanced, detailed
    
    # Template-specific features
    features: Dict[str, Any] = {}  # Domain-specific features
    suggested_categories: List[str] = []  # Document categories
    sample_queries: List[str] = []  # Example test queries
    required_metadata_fields: List[str] = []  # Required fields for this domain
    
    class Config:
        use_enum_values = True


class CreateBotFromTemplate(BaseModel):
    """Request to create bot from template"""
    template_id: str
    name: str  # Override template name
    description: Optional[str] = None  # Override description
    customize_config: Optional[Dict[str, Any]] = None  # Custom overrides
