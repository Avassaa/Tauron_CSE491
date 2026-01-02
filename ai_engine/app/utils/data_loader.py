import pandas as pd
import numpy as np
from typing import Any, Dict, List
from pathlib import Path

class DataLoader:
    @staticmethod
    def load_csv(file_path: str) -> pd.DataFrame:
        """Load data from CSV file"""
        return pd.read_csv(file_path)
    
    @staticmethod
    def load_json(file_path: str) -> Dict:
        """Load data from JSON file"""
        import json
        with open(file_path, 'r') as f:
            return json.load(f)
    
    @staticmethod
    def preprocess_data(data: pd.DataFrame, config: Dict[str, Any] = None) -> np.ndarray:
        """Preprocess data according to configuration"""
        # Placeholder for preprocessing logic
        return data.values

