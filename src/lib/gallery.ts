export interface GalleryItem {
  id: string;
  title: string;
  author: string;
  difficulty: 'easy' | 'medium' | 'hard';
  url: string;
}

export const GALLERY_ITEMS: GalleryItem[] = [
  {
    id: 'daily-1',
    title: 'Daily Puzzle: Coffee Cup',
    author: 'OpenPixel',
    difficulty: 'easy',
    url: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=400&h=400&fit=crop'
  },
  {
    id: 'retro-1',
    title: 'Retro Controller',
    author: 'OpenPixel',
    difficulty: 'medium',
    url: 'https://images.unsplash.com/photo-1531525645387-7f14be1bfc3d?w=400&h=400&fit=crop'
  },
  {
    id: 'nature-1',
    title: 'Bonsai Tree',
    author: 'OpenPixel',
    difficulty: 'hard',
    url: 'https://images.unsplash.com/photo-1599598425947-3300262939fa?w=400&h=400&fit=crop'
  },
  {
    id: 'food-1',
    title: 'Sushi Roll',
    author: 'OpenPixel',
    difficulty: 'medium',
    url: 'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=400&h=400&fit=crop'
  }
];
