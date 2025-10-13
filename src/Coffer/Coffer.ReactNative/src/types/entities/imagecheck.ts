import Item from "./item";

interface ImageCheck {
  id: string;
  state: "found" | "not found";
  quantity: number;
  similars: Item[];
}

export default ImageCheck;
