import { useNavigate } from 'react-router-dom';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Phone, MessageCircle, User } from 'lucide-react';

interface DeliveryContactCardProps {
  label: string;
  name: string | null;
  phone: string | null;
  userId: string;
}

const DeliveryContactCard = ({ label, name, phone, userId }: DeliveryContactCardProps) => {
  const navigate = useNavigate();

  return (
    <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30">
      <Avatar className="h-9 w-9">
        <AvatarFallback className="bg-primary/10 text-primary text-sm">
          {name ? name.charAt(0).toUpperCase() : <User className="h-4 w-4" />}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium truncate">{name || 'Unknown'}</p>
      </div>
      <div className="flex items-center gap-1.5">
        {phone && (
          <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
            <a href={`tel:${phone}`}>
              <Phone className="h-4 w-4" />
            </a>
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => navigate(`/messages?with=${userId}`)}
        >
          <MessageCircle className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};

export default DeliveryContactCard;
