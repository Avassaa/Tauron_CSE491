from abc import ABC, abstractmethod
from typing import Any, Dict

class BaseModel(ABC):
    def __init__(self, config: Dict[str, Any] = None):
        self.config = config or {}
        self.model = None
    
    @abstractmethod
    def load(self, model_path: str):
        """Load a trained model from disk"""
        pass
    
    @abstractmethod
    def save(self, model_path: str):
        """Save the trained model to disk"""
        pass
    
    @abstractmethod
    def train(self, training_data: Any, **kwargs):
        """Train the model on provided data"""
        pass
    
    @abstractmethod
    def predict(self, input_data: Any) -> Any:
        """Make predictions on input data"""
        pass

