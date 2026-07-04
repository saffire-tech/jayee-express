import { useState, useEffect, useRef, useMemo } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import Navbar from '@/components/layout/Navbar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MessageCircle, Send, ArrowLeft, Search, Store, Paperclip } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { sendMessageNotification } from '@/lib/pushNotifications';
import { sendMessageEmailNotification } from '@/lib/emailNotifications';
import {
  uploadMessageMedia,
  signMany,
  kindFromMime,
  MAX_MEDIA_BYTES,
  type MediaKind,
} from '@/lib/messageMedia';
import { MessageMedia, MediaPreviewChip } from '@/components/messaging/MessageMedia';

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
  content: string | null;
  sender_id: string;
  receiver_id: string;
  created_at: string;
  is_read: boolean;
  media_url?: string | null;
  media_type?: MediaKind | null;
  media_name?: string | null;
  media_size?: number | null;
  media_mime?: string | null;
}

const ACCEPT = 'image/*,video/*,audio/*,application/pdf';

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
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (user) fetchConversations();
  }, [user]);

  useEffect(() => {
    if (activeConversation && user) {
      fetchMessages(activeConversation);
      markMessagesAsRead(activeConversation);
      const conv = conversations.find((c) => c.otherUserId === activeConversation);
      setActiveConversationDetails(conv || null);
    }
  }, [activeConversation, user, conversations]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('messages-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload) => {
          const newMsg = payload.new as Message;
          if (newMsg.sender_id !== user.id && newMsg.receiver_id !== user.id) return;
          const otherUserId = newMsg.sender_id === user.id ? newMsg.receiver_id : newMsg.sender_id;

          if (activeConversation === otherUserId) {
            setMessages((prev) => {
              if (prev.some((m) => m.id === newMsg.id)) return prev;
              return [...prev, newMsg];
            });
            if (newMsg.media_url) {
              signMany([newMsg.media_url]).then((map) =>
                setSignedUrls((prev) => ({ ...prev, ...map }))
              );
            }
            if (newMsg.sender_id !== user.id) markMessagesAsRead(newMsg.sender_id);
          }
          fetchConversations();
        }
      )
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages' }, () => {
        fetchConversations();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, activeConversation]);

  const fetchConversations = async () => {
    if (!user) return;
    try {
      const { data: messagesData, error } = await supabase
        .from('messages')
        .select('*')
        .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
        .order('created_at', { ascending: false });
      if (error) throw error;

      const conversationMap = new Map<string, any>();
      for (const msg of messagesData || []) {
        const otherUserId = msg.sender_id === user.id ? msg.receiver_id : msg.sender_id;
        if (!conversationMap.has(otherUserId)) {
          conversationMap.set(otherUserId, {
            otherUserId,
            lastMessage: previewText(msg as any),
            lastMessageTime: msg.created_at,
            unreadCount: 0,
            storeId: msg.store_id,
          });
        }
        if (msg.receiver_id === user.id && !msg.is_read) {
          conversationMap.get(otherUserId).unreadCount++;
        }
      }

      const userIds = Array.from(conversationMap.keys());
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, full_name, avatar_url')
          .in('user_id', userIds);

        const storeIds = Array.from(conversationMap.values())
          .map((c) => c.storeId)
          .filter(Boolean);

        const storesMap = new Map();
        if (storeIds.length > 0) {
          const { data: stores } = await supabase
            .from('stores')
            .select('id, name, user_id')
            .in('id', storeIds);
          stores?.forEach((store) => storesMap.set(store.user_id, store.name));
        }

        const list: Conversation[] = Array.from(conversationMap.entries()).map(([id, conv]) => {
          const profile = profiles?.find((p) => p.user_id === id);
          return {
            id,
            otherUserId: id,
            otherUserName: profile?.full_name || 'Unknown User',
            otherUserAvatar: profile?.avatar_url,
            lastMessage: conv.lastMessage,
            lastMessageTime: conv.lastMessageTime,
            unreadCount: conv.unreadCount,
            storeId: conv.storeId,
            storeName: storesMap.get(id),
          };
        });

        setConversations(list);
      } else {
        setConversations([]);
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
      .or(
        `and(sender_id.eq.${user.id},receiver_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},receiver_id.eq.${user.id})`
      )
      .order('created_at', { ascending: true });
    if (error) {
      console.error('Error fetching messages:', error);
      return;
    }
    const list = (data || []) as Message[];
    setMessages(list);
    const paths = list.map((m) => m.media_url).filter(Boolean) as string[];
    if (paths.length) {
      const map = await signMany(paths);
      setSignedUrls((prev) => ({ ...prev, ...map }));
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

  const handleFilePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > MAX_MEDIA_BYTES) {
      toast.error('File too large (max 25 MB)');
      return;
    }
    setPendingFile(file);
  };

  const sendMessage = async () => {
    if (!user || !activeConversation) return;
    const text = newMessage.trim();
    if (!text && !pendingFile) return;

    setSending(true);
    try {
      const { data: senderProfile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('user_id', user.id)
        .single();

      let media: Awaited<ReturnType<typeof uploadMessageMedia>> | null = null;
      if (pendingFile) {
        setUploadProgress(0);
        media = await uploadMessageMedia(pendingFile, user.id, (pct) => setUploadProgress(pct));
      }

      const payload: any = {
        sender_id: user.id,
        receiver_id: activeConversation,
        content: text || null,
        store_id: activeConversationDetails?.storeId || null,
      };
      if (media) Object.assign(payload, media);

      const { data: inserted, error } = await supabase
        .from('messages')
        .insert(payload)
        .select('*')
        .single();

      if (error) throw error;

      if (inserted?.media_url) {
        const map = await signMany([inserted.media_url]);
        setSignedUrls((prev) => ({ ...prev, ...map }));
      }
      setMessages((prev) =>
        prev.some((m) => m.id === inserted!.id) ? prev : [...prev, inserted as Message]
      );

      setNewMessage('');
      setPendingFile(null);
      fetchConversations();

      const senderName = senderProfile?.full_name || 'Someone';
      const notifText = text || previewText(inserted as any);
      sendMessageNotification(activeConversation, senderName, notifText);
      sendMessageEmailNotification(activeConversation, senderName, notifText);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const filteredConversations = useMemo(
    () =>
      conversations.filter(
        (c) =>
          c.otherUserName.toLowerCase().includes(searchTerm.toLowerCase()) ||
          c.storeName?.toLowerCase().includes(searchTerm.toLowerCase())
      ),
    [conversations, searchTerm]
  );

  if (!user) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto px-4 py-16 text-center">
          <MessageCircle className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">Sign in to view messages</h1>
          <p className="text-muted-foreground mb-6">
            You need to be logged in to access your messages.
          </p>
          <Link to="/auth">
            <Button>Sign In</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100dvh-3.5rem)] md:h-[100dvh] bg-background flex flex-col overflow-hidden">
      <div className="shrink-0">
        <Navbar />
      </div>

      <main className="flex-1 min-h-0 flex md:p-4 md:pt-20 pt-16">
        <div className="flex-1 min-h-0 bg-card md:border md:border-border md:rounded-xl overflow-hidden flex">
          {/* Conversations list */}
          <aside
            className={`w-full md:w-80 border-r border-border flex-col min-h-0 ${
              activeConversation ? 'hidden md:flex' : 'flex'
            }`}
          >
            <div className="p-4 border-b border-border shrink-0">
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

            <ScrollArea className="flex-1 min-h-0">
              {loading ? (
                <div className="p-4 text-center text-muted-foreground">Loading...</div>
              ) : filteredConversations.length === 0 ? (
                <div className="p-8 text-center">
                  <MessageCircle className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground">No conversations yet</p>
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
          </aside>

          {/* Chat panel */}
          <section
            className={`flex-1 min-h-0 flex-col ${
              !activeConversation ? 'hidden md:flex' : 'flex'
            }`}
          >
            {activeConversation ? (
              <>
                <header className="shrink-0 p-4 border-b border-border flex items-center gap-3 bg-card">
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
                  <div className="min-w-0">
                    <h2 className="font-semibold truncate">
                      {activeConversationDetails?.otherUserName || 'Loading...'}
                    </h2>
                    {activeConversationDetails?.storeName && (
                      <p className="text-sm text-primary truncate">
                        {activeConversationDetails.storeName}
                      </p>
                    )}
                  </div>
                </header>

                <ScrollArea className="flex-1 min-h-0">
                  <div className="p-4 space-y-3">
                    {messages.map((msg) => {
                      const isOwn = msg.sender_id === user.id;
                      const url = msg.media_url ? signedUrls[msg.media_url] : null;
                      return (
                        <div
                          key={msg.id}
                          className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}
                        >
                          <div
                            className={`max-w-[80%] rounded-2xl px-3 py-2 space-y-2 ${
                              isOwn
                                ? 'bg-primary text-primary-foreground rounded-br-md'
                                : 'bg-muted rounded-bl-md'
                            }`}
                          >
                            {msg.media_url && msg.media_type && url && (
                              <MessageMedia
                                url={url}
                                type={msg.media_type}
                                name={msg.media_name}
                                size={msg.media_size}
                                mime={msg.media_mime}
                                isOwn={isOwn}
                              />
                            )}
                            {msg.media_url && msg.media_type && !url && (
                              <div className="text-xs opacity-70 px-2 py-3">Loading media…</div>
                            )}
                            {msg.content && (
                              <p className="whitespace-pre-wrap break-words px-1">{msg.content}</p>
                            )}
                            <p
                              className={`text-[10px] text-right ${
                                isOwn ? 'text-primary-foreground/70' : 'text-muted-foreground'
                              }`}
                            >
                              {format(new Date(msg.created_at), 'h:mm a')}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                    <div ref={messagesEndRef} />
                  </div>
                </ScrollArea>

                <div
                  className="shrink-0 p-3 border-t border-border bg-card"
                  style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
                >
                  {pendingFile && (
                    <div className="mb-2">
                      <MediaPreviewChip file={pendingFile} onRemove={() => setPendingFile(null)} />
                    </div>
                  )}
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      sendMessage();
                    }}
                    className="flex gap-2 items-center"
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept={ACCEPT}
                      className="hidden"
                      onChange={handleFilePick}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={sending}
                    >
                      <Paperclip className="h-5 w-5" />
                    </Button>
                    <Input
                      placeholder={pendingFile ? 'Add a caption…' : 'Type a message...'}
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      className="flex-1"
                      disabled={sending}
                    />
                    <Button
                      type="submit"
                      disabled={sending || (!newMessage.trim() && !pendingFile)}
                    >
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
          </section>
        </div>
      </main>
    </div>
  );
};

function previewText(msg: { content?: string | null; media_type?: MediaKind | null }): string {
  if (msg.content) return msg.content;
  switch (msg.media_type) {
    case 'image':
      return '📷 Photo';
    case 'video':
      return '🎥 Video';
    case 'audio':
      return '🎵 Audio';
    case 'file':
      return '📎 File';
    default:
      return '';
  }
}

export default Messages;
