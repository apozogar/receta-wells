export interface Recipe {
  id: number;
  name: string;
  type: 'legumbres' | 'verduras' | 'pescado' | 'pasta' | 'carne' | 'cena' | 'free' | 'arroz';
  timeSlot: 'lunch' | 'dinner' | 'any';
  tags: string[];
  ingredients?: string[];
}