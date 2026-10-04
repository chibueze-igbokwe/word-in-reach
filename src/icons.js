import {
  ArrowRight,
  BookOpen,
  Bookmark,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Compass,
  Ellipsis,
  Heart,
  House,
  Menu,
  Plus,
  Search,
  Share2,
  Sparkles,
  Volume2,
  X,
  createElement,
} from 'lucide';

const icons = {
  'arrow-right': ArrowRight,
  'book-open': BookOpen,
  bookmark: Bookmark,
  'chevron-left': ChevronLeft,
  'chevron-right': ChevronRight,
  'chevron-up': ChevronUp,
  compass: Compass,
  ellipsis: Ellipsis,
  heart: Heart,
  house: House,
  menu: Menu,
  plus: Plus,
  search: Search,
  'share-2': Share2,
  sparkles: Sparkles,
  'volume-2': Volume2,
  x: X,
};

export function createIcon(name, className = '') {
  return createElement(icons[name], {
    class: `app-icon ${className}`.trim(),
    'aria-hidden': 'true',
    width: 20,
    height: 20,
    'stroke-width': 1.8,
  });
}

export function mountIcons(root = document) {
  root.querySelectorAll('[data-icon]').forEach((placeholder) => {
    placeholder.replaceChildren(createIcon(placeholder.dataset.icon));
  });
}
