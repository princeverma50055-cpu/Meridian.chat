import { cn } from '@/lib/utils/cn';

interface AvatarProps {
  name: string;
  imageUrl?: string;
  size?: number;
  className?: string;
}

export function Avatar({ name, imageUrl, size = 32, className }: AvatarProps) {
  const initials = name
    .split(' ')
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  if (imageUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={imageUrl}
        alt={name}
        width={size}
        height={size}
        className={cn('rounded-full object-cover', className)}
      />
    );
  }

  return (
    <div
      style={{ width: size, height: size, fontSize: size * 0.4 }}
      className={cn(
        'flex items-center justify-center rounded-full bg-cobalt/10 font-medium text-cobalt',
        className
      )}
    >
      {initials || '?'}
    </div>
  );
}
