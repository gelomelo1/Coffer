import Attribute from "./attribute";

interface CollectionType {
  id: number;
  name: string;
  description: string;
  color: string;
  icon: string;
  attributes: Attribute[];
}

export default CollectionType;
