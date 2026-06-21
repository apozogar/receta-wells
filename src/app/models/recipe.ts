export interface Recipe {
  id: number;
  name: string;
  type: string;
  slot: 'lunch' | 'dinner' | 'any';
  tags: string[];
  cookidooId?: string;
  servings: number;
  image_url: string;
}