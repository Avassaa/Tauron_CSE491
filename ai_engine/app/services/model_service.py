from typing import Any, Dict
from app.models.base_model import BaseModel

class ModelService:
    def __init__(self):
        self.models: Dict[str, BaseModel] = {}
    
    def register_model(self, model_id: str, model: BaseModel):
        """Register a model instance"""
        self.models[model_id] = model
    
    def get_model(self, model_id: str) -> BaseModel:
        """Get a registered model"""
        if model_id not in self.models:
            raise ValueError(f"Model {model_id} not found")
        return self.models[model_id]
    
    def predict(self, model_id: str, input_data: Any) -> Any:
        """Make a prediction using a registered model"""
        model = self.get_model(model_id)
        return model.predict(input_data)

