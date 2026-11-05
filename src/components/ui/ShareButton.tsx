import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Share2, Copy, Check, MessageCircle } from 'lucide-react';
import { toast } from 'sonner';

interface ShareButtonProps {
  url: string;
  title: string;
  description?: string;
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'default' | 'sm' | 'lg' | 'icon';
}

const ShareButton = ({ url, title, description, variant = 'outline', size = 'default' }: ShareButtonProps) => {
  const [copied, setCopied] = useState(false);

  // Use same-domain routes so shared links stay clean while Vercel serves OG metadata.
  const getShareableUrl = () => {
    const origin = window.location.origin;
    const path = url.startsWith('/') ? url : `/${url}`;

    const productMatch = path.match(/^\/product\/([a-zA-Z0-9-]+)/);
    const storeMatch = path.match(/^\/store\/([a-zA-Z0-9-]+)/);
    const serviceMatch = path.match(/^\/service\/([a-zA-Z0-9-]+)/);

    if (productMatch) return `${origin}/share/product/${productMatch[1]}`;
    if (storeMatch) return `${origin}/share/store/${storeMatch[1]}`;

    if (serviceMatch) {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      return `${supabaseUrl}/functions/v1/og-redirect?type=service&id=${serviceMatch[1]}&origin=${encodeURIComponent(origin)}`;
    }

    return `${origin}${path}`;
  };

  const fullUrl = getShareableUrl();
  const encodedUrl = encodeURIComponent(fullUrl);
  const encodedTitle = encodeURIComponent(title);

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(fullUrl);
      setCopied(true);
      toast.success('Link copied to clipboard!');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy link');
    }
  };

  const shareToWhatsApp = () => {
    window.open(`https://wa.me/?text=${encodeURIComponent(`${title}\n${fullUrl}`)}`, '_blank');
  };

  const shareToTwitter = () => {
    window.open(
      `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedTitle}`,
      '_blank'
    );
  };

  const shareToFacebook = () => {
    window.open(
      `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
      '_blank'
    );
  };

  const shareToTelegram = () => {
    window.open(
      `https://t.me/share/url?url=${encodedUrl}&text=${encodedTitle}`,
      '_blank'
    );
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant={variant} size={size}>
          <Share2 className="h-4 w-4" />
          {size !== 'icon' && <span className="ml-2">Share</span>}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onClick={copyToClipboard} className="cursor-pointer">
          {copied ? <Check className="h-4 w-4 mr-2 text-green-500" /> : <Copy className="h-4 w-4 mr-2" />}
          Copy Link
        </DropdownMenuItem>
        <DropdownMenuItem onClick={shareToWhatsApp} className="cursor-pointer">
          <MessageCircle className="h-4 w-4 mr-2 text-green-500" />
          WhatsApp
        </DropdownMenuItem>
        <DropdownMenuItem onClick={shareToTwitter} className="cursor-pointer">
          <svg className="h-4 w-4 mr-2" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
          </svg>
          X (Twitter)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={shareToFacebook} className="cursor-pointer">
          <svg className="h-4 w-4 mr-2 text-blue-600" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M24 12.073c0-6.627-5.373-12-12-12S0 5.446 0 12.073c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953h-1.513c-1.491 0-1.956.925-1.956 1.874v2.249h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
          </svg>
          Facebook
        </DropdownMenuItem>
        <DropdownMenuItem onClick={shareToTelegram} className="cursor-pointer">
          <svg className="h-4 w-4 mr-2 text-blue-400" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.3.02.45-.18 1.897-.96 6.5-1.357 8.627-.168.9-.5 1.202-.822 1.231-.7.064-1.232-.463-1.91-.907-1.06-.694-1.66-1.126-2.689-1.804-1.19-.784-.418-1.214.26-1.916.177-.184 3.247-2.976 3.307-3.23.008-.032.015-.15-.056-.212-.07-.062-.174-.041-.25-.024-.107.024-1.804 1.146-5.092 3.367-.482.331-.918.492-1.308.484-.43-.009-1.258-.243-1.873-.443-.754-.245-1.353-.374-1.301-.79.027-.217.326-.438.898-.663 3.516-1.531 5.861-2.54 7.037-3.026 3.348-1.395 4.044-1.637 4.498-1.645.1-.002.321.023.465.14z" />
          </svg>
          Telegram
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default ShareButton;
