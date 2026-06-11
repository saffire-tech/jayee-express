import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MessageCircle, Send, ArrowLeft, Search, Store, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { sendMessageNotification } from '@/lib/pushNotifications';
import { sendMessageEmailNotification } from '@/lib/emailNotifications';

interface Conversation {
  id: string;
  otherUserId: string;
  otherUserName: string;
  otherUserAvatar: string | null;
  lastMessage: string;
  lastMessageTime: string;
  unreadCount: number;
  storeId?: string;
  storeName?: string;
}

interface Message {
  id: string;
  content: string;
  sender_id: string;
  receiver_id: string;
  created_at: string;
  is_read: boolean;
}

const Messages = () => {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeConversation = searchParams.get('with');
  
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeConversationDetails, setActiveConversationDetails] = useState<Conversation | null>(null);

  useEffect(() => {
    if (user) {
      fetchConversations();
    }
  }, [user]);

  useEffect(() => {
    if (activeConversation && user) {
      fetchMessages(activeConversation);
      markMessagesAsRead(activeConversation);
      
      // Find conversation details
      const conv = conversations.find(c => c.otherUserId === activeConversation);
      setActiveConversationDetails(conv || null);
    }
  }, [activeConversation, user, conversations]);

  useEffect(() => {
    if (!user) return;

    // Subscribe to new messages (both incoming and outgoing)
    const channel = supabase
      .channel('messages-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
        },
        (payload) => {
          const newMsg = payload.new as Message;
          // Only process if user is sender or receiver
          if (newMsg.sender_id !== user.id && newMsg.receiver_id !== user.id) return;
          
          const otherUserId = newMsg.sender_id === user.id ? newMsg.receiver_id : newMsg.sender_id;
          
          if (activeConversation === otherUserId) {
            // Check if message already exists (to avoid duplicates from optimistic updates)
            setMessages(prev => {
              if (prev.some(m => m.id === newMsg.id)) return prev;
              return [...prev, newMsg];
            });
            if (newMsg.sender_id !== user.id) {
              markMessagesAsRead(newMsg.sender_id);
            }
          }
          fetchConversations();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
        },
        () => {
          fetchConversations();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, activeConversation]);

  const fetchConversations = async () => {
    if (!user) return;

    try {
      // Get all messages involving the user
      const { data: messagesData, error } = await supabase
        .from('messages')
        .select('*')
        .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Group by conversation partner
      const conversationMap = new Map<string, any>();
      
      for (const msg of messagesData || []) {
        const otherUserId = msg.sender_id === user.id ? msg.receiver_id : msg.sender_id;
        
        if (!conversationMap.has(otherUserId)) {
          conversationMap.set(otherUserId, {
            otherUserId,
            lastMessage: msg.content,
            lastMessageTime: msg.created_at,
            unreadCount: 0,
            storeId: msg.store_id,
            messages: []
          });
        }
        
        if (msg.receiver_id === user.id && !msg.is_read) {
          conversationMap.get(otherUserId).unreadCount++;
        }
      }

      // Fetch user profiles
      const userIds = Array.from(conversationMap.keys());
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, full_name, avatar_url')
          .in('user_id', userIds);

        // Fetch store info for store conversations
        const storeIds = Array.from(conversationMap.values())
          .map(c => c.storeId)
          .filter(Boolean);
        
        let storesMap = new Map();
        if (storeIds.length > 0) {
          const { data: stores } = await supabase
            .from('stores')
            .select('id, name, user_id')
            .in('id', storeIds);
          
          stores?.forEach(store => {
            storesMap.set(store.user_id, store.name);
          });
        }

        const conversationsList: Conversation[] = Array.from(conversationMap.entries()).map(([id, conv]) => {
          const profile = profiles?.find(p => p.user_id === id);
          return {
            id,
            otherUserId: id,
            otherUserName: profile?.full_name || 'Unknown User',
            otherUserAvatar: profile?.avatar_url,
            lastMessage: conv.lastMessage,
            lastMessageTime: conv.lastMessageTime,
            unreadCount: conv.unreadCount,
            storeId: conv.storeId,
            storeName: storesMap.get(id)
          };
        });

        setConversations(conversationsList);
      }
    } catch (error) {
      console.error('Error fetching conversations:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async (otherUserId: string) => {
    if (!user) return;

    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .or(`and(sender_id.eq.${user.id},receiver_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},receiver_id.eq.${user.id})`)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching messages:', error);
    } else {
      setMessages(data || []);
    }
  };

  const markMessagesAsRead = async (senderId: string) => {
    if (!user) return;

    await supabase
      .from('messages')
      .update({ is_read: true })
      .eq('sender_id', senderId)
      .eq('receiver_id', user.id)
      .eq('is_read', false);
  };

  const sendMessage = async () => {
    if (!user || !activeConversation || !newMessage.trim()) return;

    setSending(true);
    const messageContent = newMessage.trim();
    
    // Get sender's profile for name
    const { data: senderProfile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('user_id', user.id)
      .single();
    
    const { error } = await supabase
      .from('messages')
      .insert({
        sender_id: user.id,
        receiver_id: activeConversation,
        content: messageContent,
        store_id: activeConversationDetails?.storeId || null
      });

    if (error) {
      toast.error('Failed to send message');
    } else {
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        content: messageContent,
        sender_id: user.id,
        receiver_id: activeConversation,
        created_at: new Date().toISOString(),
        is_read: false
      }]);
      setNewMessage('');
      fetchConversations();
      
      // Get sender name for notifications
      const senderName = senderProfile?.full_name || 'Someone';
      
      // Send push notification to receiver
      sendMessageNotification(activeConversation, senderName, messageContent);
      
      // Send email notification to receiver
      sendMessageEmailNotification(activeConversation, senderName, messageContent);
    }
    setSending(false);
  };

  const filteredConversations = conversations.filter(c => 
    c.otherUserName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.storeName?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (!user) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto px-4 py-16 text-center">
          <MessageCircle className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">Sign in to view messages</h1>
          <p className="text-muted-foreground mb-6">You need to be logged in to access your messages.</p>
          <Link to="/auth">
            <Button>Sign In</Button>
          </Link>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />
      
      <main className="flex-1 container mx-auto px-4 pt-20 pb-4 md:py-6">
        <div className="bg-card border border-border rounded-xl overflow-hidden h-[calc(100vh-140px)] md:h-[calc(100vh-200px)] flex">
          {/* Conversations List */}
          <div className={`w-full md:w-80 border-r border-border flex flex-col ${activeConversation ? 'hidden md:flex' : 'flex'}`}>
            <div className="p-4 border-b border-border">
              <h1 className="text-xl font-bold mb-3">Messages</h1>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search conversations..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            
            <ScrollArea className="flex-1">
              {loading ? (
                <div className="p-4 text-center text-muted-foreground">Loading...</div>
              ) : filteredConversations.length === 0 ? (
                <div className="p-8 text-center">
                  <MessageCircle className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground">No conversations yet</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Start a conversation by contacting a seller
                  </p>
                </div>
              ) : (
                filteredConversations.map((conv) => (
                  <button
                    key={conv.otherUserId}
                    onClick={() => setSearchParams({ with: conv.otherUserId })}
                    className={`w-full p-4 flex items-start gap-3 hover:bg-muted/50 transition-colors text-left border-b border-border ${
                      activeConversation === conv.otherUserId ? 'bg-muted' : ''
                    }`}
                  >
                    <Avatar className="h-12 w-12 shrink-0">
                      <AvatarImage src={conv.otherUserAvatar || ''} />
                      <AvatarFallback>{conv.otherUserName.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold truncate">{conv.otherUserName}</span>
                        <span className="text-xs text-muted-foreground shrink-0">
                          {format(new Date(conv.lastMessageTime), 'MMM d')}
                        </span>
                      </div>
                      {conv.storeName && (
                        <div className="flex items-center gap-1 text-xs text-primary mb-1">
                          <Store className="h-3 w-3" />
                          {conv.storeName}
                        </div>
                      )}
                      <p className="text-sm text-muted-foreground truncate">{conv.lastMessage}</p>
                    </div>
                    {conv.unreadCount > 0 && (
                      <Badge className="shrink-0">{conv.unreadCount}</Badge>
                    )}
                  </button>
                ))
              )}
            </ScrollArea>
          </div>

          {/* Chat Area */}
          <div className={`flex-1 flex flex-col ${!activeConversation ? 'hidden md:flex' : 'flex'}`}>
            {activeConversation ? (
              <>
                {/* Chat Header */}
                <div className="p-4 border-b border-border flex items-center gap-3">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="md:hidden"
                    onClick={() => setSearchParams({})}
                  >
                    <ArrowLeft className="h-5 w-5" />
                  </Button>
                  <Avatar>
                    <AvatarImage src={activeConversationDetails?.otherUserAvatar || ''} />
                    <AvatarFallback>
                      {activeConversationDetails?.otherUserName?.charAt(0) || '?'}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h2 className="font-semibold">{activeConversationDetails?.otherUserName || 'Loading...'}</h2>
                    {activeConversationDetails?.storeName && (
                      <p className="text-sm text-primary">{activeConversationDetails.storeName}</p>
                    )}
                  </div>
                </div>

                {/* Messages */}
                <ScrollArea className="flex-1 p-4">
                  <div className="space-y-4">
                    {messages.map((msg) => (
                      <div
                        key={msg.id}
                        className={`flex ${msg.sender_id === user.id ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-[80%] rounded-2xl px-4 py-2 ${
                            msg.sender_id === user.id
                              ? 'bg-primary text-primary-foreground rounded-br-md'
                              : 'bg-muted rounded-bl-md'
                          }`}
                        >
                          <p>{msg.content}</p>
                          <p className={`text-xs mt-1 ${
                            msg.sender_id === user.id ? 'text-primary-foreground/70' : 'text-muted-foreground'
                          }`}>
                            {format(new Date(msg.created_at), 'h:mm a')}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>

                
                {/* Message Input */}
                <div className="p-4 border-t border-border">
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      sendMessage();
                    }}
                    className="flex gap-2"
                  >
                    <Input
                      placeholder="Type a message..."
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      className="flex-1"
                    />
                    <Button type="submit" disabled={sending || !newMessage.trim()}>
                      <Send className="h-4 w-4" />
                    </Button>
                  </form>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-center p-8">
                <div>
                  <MessageCircle className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                  <h2 className="text-xl font-semibold mb-2">Select a conversation</h2>
                  <p className="text-muted-foreground">
                    Choose a conversation from the list to start chatting
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default Messages;
