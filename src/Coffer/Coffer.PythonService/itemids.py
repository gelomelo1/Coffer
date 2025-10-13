from uuid import UUID
from pydantic import BaseModel, Field


class ItemIds(BaseModel):
    temp_id: UUID = Field(..., alias="tempId")
    id: UUID = Field(..., alias="id")