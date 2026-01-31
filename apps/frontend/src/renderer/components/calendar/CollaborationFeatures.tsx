import { useState, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Download,
  Share2,
  MessageSquare,
  User,
  Users,
  Link2,
  Copy,
  Check,
  X,
  Send,
  Filter,
  Image as ImageIcon,
  FileText,
  Calendar,
  ChevronDown,
  ChevronUp,
  MoreVertical,
  Reply,
} from 'lucide-react';
import { useCalendarStore } from '../../../stores/calendarStore';
import type { CalendarItem } from '../../../shared/types';

// Comment interface
export interface CalendarComment {
  id: string;
  itemId: string;
  author: string;
  authorEmail?: string;
  content: string;
  createdAt: Date;
  replies?: CalendarComment[];
}

// Assignment interface
export interface CalendarAssignment {
  itemId: string;
  assignee: string;
  assigneeEmail?: string;
  role: 'owner' | 'editor' | 'viewer';
  assignedAt: Date;
}

// Approval workflow status
export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'changes-requested';

// Approval request interface
export interface ApprovalRequest {
  id: string;
  itemId: string;
  requester: string;
  reviewer: string;
  status: ApprovalStatus;
  createdAt: Date;
  reviewedAt?: Date;
  comments?: string;
}

interface CollaborationFeaturesProps {
  projectId: string;
  selectedItem: CalendarItem | null;
  onClose?: () => void;
}

export function CollaborationFeatures({
  projectId,
  selectedItem,
  onClose,
}: CollaborationFeaturesProps) {
  const { updateItem } = useCalendarStore();

  // UI State
  const [activeTab, setActiveTab] = useState<'comments' | 'assignments' | 'approvals' | 'share'>('comments');
  const [showSharePanel, setShowSharePanel] = useState(false);
  const [calendarFeedUrl, setCalendarFeedUrl] = useState<string | null>(null);

  // Sample data (in real app, this would come from backend)
  const [comments, setComments] = useState<CalendarComment[]>([]);
  const [assignments, setAssignments] = useState<CalendarAssignment[]>([]);
  const [approvalRequests, setApprovalRequests] = useState<ApprovalRequest[]>([]);

  // Comments state
  const [newComment, setNewComment] = useState('');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState('');

  // Export state
  const [isExporting, setIsExporting] = useState(false);
  const calendarRef = useRef<HTMLDivElement>(null);

  // Generate calendar feed URL
  const generateFeedUrl = () => {
    // In real app, this would generate a unique feed URL for the calendar
    const feedId = btoa(`${projectId}-${Date.now()}`).substring(0, 12);
    return `https://calendar.marketinghub.com/feed/${feedId}`;
  };

  // Copy feed URL to clipboard
  const copyFeedUrl = () => {
    const url = generateFeedUrl();
    navigator.clipboard.writeText(url);
    setCalendarFeedUrl(url);
  };

  // Add comment
  const addComment = () => {
    if (!selectedItem || !newComment.trim()) return;

    const comment: CalendarComment = {
      id: `comment-${Date.now()}`,
      itemId: selectedItem.id,
      author: 'You', // In real app, would get from auth
      content: newComment.trim(),
      createdAt: new Date(),
    };

    setComments([...comments, comment]);
    setNewComment('');
  };

  // Add reply
  const addReply = (parentId: string) => {
    if (!selectedItem || !replyContent.trim()) return;

    const reply: CalendarComment = {
      id: `reply-${Date.now()}`,
      itemId: selectedItem.id,
      author: 'You',
      content: replyContent.trim(),
      createdAt: new Date(),
    };

    setComments(
      comments.map((comment) => {
        if (comment.id === parentId) {
          return {
            ...comment,
            replies: [...(comment.replies || []), reply],
          };
        }
        return comment;
      })
    );

    setReplyContent('');
    setReplyingTo(null);
  };

  // Assign user
  const assignUser = (email: string, role: Assignment['role']) => {
    if (!selectedItem) return;

    const assignment: CalendarAssignment = {
      itemId: selectedItem.id,
      assignee: email.split('@')[0],
      assigneeEmail: email,
      role,
      assignedAt: new Date(),
    };

    setAssignments([...assignments, assignment]);
  };

  // Create approval request
  const createApprovalRequest = (reviewerEmail: string) => {
    if (!selectedItem) return;

    const request: ApprovalRequest = {
      id: `approval-${Date.now()}`,
      itemId: selectedItem.id,
      requester: 'You',
      reviewer: reviewerEmail.split('@')[0],
      reviewerEmail: reviewerEmail,
      status: 'pending',
      createdAt: new Date(),
    };

    setApprovalRequests([...approvalRequests, request]);
  };

  // Export calendar as image
  const exportAsImage = async () => {
    if (!calendarRef.current) return;

    setIsExporting(true);
    try {
      // In real app, would use html2canvas or similar
      // For now, just show a success message
      await new Promise((resolve) => setTimeout(resolve, 1000));
      alert('Calendar exported as image! (Demo)');
    } finally {
      setIsExporting(false);
    }
  };

  // Export calendar as PDF
  const exportAsPDF = async () => {
    setIsExporting(true);
    try {
      // In real app, would use jsPDF or similar
      await new Promise((resolve) => setTimeout(resolve, 1000));
      alert('Calendar exported as PDF! (Demo)');
    } finally {
      setIsExporting(false);
    }
  };

  if (!selectedItem) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        <p>Select a calendar item to view collaboration options</p>
      </div>
    );
  }

  const itemComments = comments.filter((c) => c.itemId === selectedItem.id);
  const itemAssignments = assignments.filter((a) => a.itemId === selectedItem.id);
  const itemApprovals = approvalRequests.filter((a) => a.itemId === selectedItem.id);

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Tabs */}
      <div className="flex items-center gap-1 p-2 border-b bg-card">
        <TabButton
          active={activeTab === 'comments'}
          onClick={() => setActiveTab('comments')}
          icon={MessageSquare}
          label="Comments"
          count={itemComments.length}
        />
        <TabButton
          active={activeTab === 'assignments'}
          onClick={() => setActiveTab('assignments')}
          icon={Users}
          label="Assigned"
          count={itemAssignments.length}
        />
        <TabButton
          active={activeTab === 'approvals'}
          onClick={() => setActiveTab('approvals')}
          icon={Check}
          label="Approvals"
          count={itemApprovals.length}
        />
        <TabButton
          active={activeTab === 'share'}
          onClick={() => setActiveTab('share')}
          icon={Share2}
          label="Share"
        />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {activeTab === 'comments' && (
          <CommentsTab
            comments={itemComments}
            newComment={newComment}
            replyingTo={replyingTo}
            replyContent={replyContent}
            onNewCommentChange={setNewComment}
            onReplyContentChange={setReplyContent}
            onAddComment={addComment}
            onReply={addReply}
            onReplyTo={setReplyingTo}
          />
        )}

        {activeTab === 'assignments' && (
          <AssignmentsTab
            assignments={itemAssignments}
            onAssignUser={assignUser}
          />
        )}

        {activeTab === 'approvals' && (
          <ApprovalsTab
            approvalRequests={itemApprovals}
            onCreateRequest={createApprovalRequest}
          />
        )}

        {activeTab === 'share' && (
          <ShareTab
            itemId={selectedItem.id}
            onExportImage={exportAsImage}
            onExportPDF={exportAsPDF}
            isExporting={isExporting}
            feedUrl={calendarFeedUrl}
            onCopyFeedUrl={copyFeedUrl}
          />
        )}
      </div>
    </div>
  );
}

// Tab Button Component
function TabButton({
  active,
  onClick,
  icon: Icon,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof MessageSquare;
  label: string;
  count?: number;
}) {
  return (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={`
        flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors
        ${active ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'}
      `}
    >
      <Icon className="h-4 w-4" />
      <span>{label}</span>
      {count !== undefined && count > 0 && (
        <span
          className={`
            px-1.5 py-0.5 rounded-full text-xs
            ${active ? 'bg-primary-foreground/20' : 'bg-muted'}
          `}
        >
          {count}
        </span>
      )}
    </motion.button>
  );
}

// Comments Tab
function CommentsTab({
  comments,
  newComment,
  replyingTo,
  replyContent,
  onNewCommentChange,
  onReplyContentChange,
  onAddComment,
  onReply,
  onReplyTo,
}: {
  comments: CalendarComment[];
  newComment: string;
  replyingTo: string | null;
  replyContent: string;
  onNewCommentChange: (value: string) => void;
  onReplyContentChange: (value: string) => void;
  onAddComment: () => void;
  onReply: (parentId: string) => void;
  onReplyTo: (id: string | null) => void;
}) {
  return (
    <div className="p-4 space-y-4">
      {/* Comments List */}
      <div className="space-y-3">
        {comments.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm">
            No comments yet. Start the conversation!
          </div>
        ) : (
          comments.map((comment) => (
            <div key={comment.id} className="bg-muted/30 rounded-lg p-3">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <User className="h-4 w-4 text-primary" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{comment.author}</span>
                    <span className="text-xs text-muted-foreground">
                      {format(comment.createdAt, 'MMM d, yyyy • h:mm a')}
                    </span>
                  </div>

                  <p className="text-sm mt-1">{comment.content}</p>

                  {/* Replies */}
                  {comment.replies && comment.replies.length > 0 && (
                    <div className="mt-2 space-y-2 pl-3 border-l-2 border-border">
                      {comment.replies.map((reply) => (
                        <div key={reply.id}>
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-xs">{reply.author}</span>
                            <span className="text-xs text-muted-foreground">
                              {format(reply.createdAt, 'MMM d, h:mm a')}
                            </span>
                          </div>
                          <p className="text-xs mt-0.5">{reply.content}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Reply button */}
                  {replyingTo !== comment.id && (
                    <button
                      onClick={() => onReplyTo(comment.id)}
                      className="mt-2 text-xs text-primary hover:underline flex items-center gap-1"
                    >
                      <Reply className="h-3 w-3" />
                      Reply
                    </button>
                  )}

                  {/* Reply input */}
                  {replyingTo === comment.id && (
                    <div className="mt-2">
                      <textarea
                        value={replyContent}
                        onChange={(e) => onReplyContentChange(e.target.value)}
                        placeholder="Write a reply..."
                        className="w-full px-2 py-1.5 rounded border bg-background text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary"
                        rows={2}
                      />
                      <div className="flex items-center justify-end gap-2 mt-1">
                        <button
                          onClick={() => onReplyTo(null)}
                          className="px-2 py-1 rounded text-xs hover:bg-accent"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => onReply(comment.id)}
                          disabled={!replyContent.trim()}
                          className="px-2 py-1 rounded bg-primary text-primary-foreground text-xs disabled:opacity-50"
                        >
                          Reply
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* New Comment */}
      <div className="border-t pt-3">
        <textarea
          value={newComment}
          onChange={(e) => onNewCommentChange(e.target.value)}
          placeholder="Write a comment..."
          className="w-full px-3 py-2 rounded-lg border bg-background resize-none focus:outline-none focus:ring-2 focus:ring-primary"
          rows={3}
        />
        <div className="flex items-center justify-end mt-2">
          <button
            onClick={onAddComment}
            disabled={!newComment.trim()}
            className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium flex items-center gap-1 disabled:opacity-50"
          >
            <Send className="h-4 w-4" />
            Comment
          </button>
        </div>
      </div>
    </div>
  );
}

// Assignments Tab
function AssignmentsTab({
  assignments,
  onAssignUser,
}: {
  assignments: CalendarAssignment[];
  onAssignUser: (email: string, role: 'owner' | 'editor' | 'viewer') => void;
}) {
  const [newAssignee, setNewAssignee] = useState('');
  const [newRole, setNewRole] = useState<'owner' | 'editor' | 'viewer'>('editor');

  return (
    <div className="p-4 space-y-4">
      {/* Current Assignments */}
      <div>
        <h3 className="text-sm font-semibold mb-2">Assigned Team Members</h3>

        {assignments.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm">
            No one assigned yet
          </div>
        ) : (
          <div className="space-y-2">
            {assignments.map((assignment, index) => (
              <div
                key={index}
                className="flex items-center gap-3 p-2 rounded bg-muted/30"
              >
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="h-4 w-4 text-primary" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{assignment.assignee}</div>
                  <div className="text-xs text-muted-foreground">{assignment.role}</div>
                </div>

                <button className="p-1 rounded hover:bg-accent">
                  <MoreVertical className="h-4 w-4 text-muted-foreground" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Assignment */}
      <div className="border-t pt-4">
        <h3 className="text-sm font-semibold mb-2">Assign Team Member</h3>

        <div className="space-y-2">
          <input
            type="email"
            value={newAssignee}
            onChange={(e) => setNewAssignee(e.target.value)}
            placeholder="colleague@example.com"
            className="w-full px-3 py-2 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />

          <select
            value={newRole}
            onChange={(e) => setNewRole(e.target.value as 'owner' | 'editor' | 'viewer')}
            className="w-full px-3 py-2 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="viewer">Can view</option>
            <option value="editor">Can edit</option>
            <option value="owner">Is owner</option>
          </select>

          <button
            onClick={() => {
              if (newAssignee) {
                onAssignUser(newAssignee, newRole);
                setNewAssignee('');
              }
            }}
            disabled={!newAssignee}
            className="w-full px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50"
          >
            Assign
          </button>
        </div>
      </div>
    </div>
  );
}

// Approvals Tab
function ApprovalsTab({
  approvalRequests,
  onCreateRequest,
}: {
  approvalRequests: ApprovalRequest[];
  onCreateRequest: (email: string) => void;
}) {
  const [reviewerEmail, setReviewerEmail] = useState('');

  const getStatusColor = (status: ApprovalStatus) => {
    switch (status) {
      case 'pending':
        return 'bg-amber-500/20 text-amber-600';
      case 'approved':
        return 'bg-emerald-500/20 text-emerald-600';
      case 'rejected':
        return 'bg-red-500/20 text-red-600';
      case 'changes-requested':
        return 'bg-blue-500/20 text-blue-600';
      default:
        return 'bg-gray-500/20 text-gray-600';
    }
  };

  return (
    <div className="p-4 space-y-4">
      {/* Approval Requests */}
      <div>
        <h3 className="text-sm font-semibold mb-2">Approval Requests</h3>

        {approvalRequests.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm">
            No approval requests
          </div>
        ) : (
          <div className="space-y-2">
            {approvalRequests.map((request) => (
              <div key={request.id} className="p-3 rounded bg-muted/30">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-sm">{request.reviewer}</span>
                  <span className={`px-2 py-0.5 rounded text-xs capitalize ${getStatusColor(request.status)}`}>
                    {request.status.replace('-', ' ')}
                  </span>
                </div>

                <div className="text-xs text-muted-foreground">
                  Requested {format(request.createdAt, 'MMM d, yyyy')}
                </div>

                {request.comments && (
                  <div className="mt-2 text-sm">{request.comments}</div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Request Approval */}
      <div className="border-t pt-4">
        <h3 className="text-sm font-semibold mb-2">Request Approval</h3>

        <div className="space-y-2">
          <input
            type="email"
            value={reviewerEmail}
            onChange={(e) => setReviewerEmail(e.target.value)}
            placeholder="reviewer@example.com"
            className="w-full px-3 py-2 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />

          <button
            onClick={() => {
              if (reviewerEmail) {
                onCreateRequest(reviewerEmail);
                setReviewerEmail('');
              }
            }}
            disabled={!reviewerEmail}
            className="w-full px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50"
          >
            Send Approval Request
          </button>
        </div>
      </div>
    </div>
  );
}

// Share Tab
function ShareTab({
  itemId,
  onExportImage,
  onExportPDF,
  isExporting,
  feedUrl,
  onCopyFeedUrl,
}: {
  itemId: string;
  onExportImage: () => void;
  onExportPDF: () => void;
  isExporting: boolean;
  feedUrl: string | null;
  onCopyFeedUrl: () => void;
}) {
  return (
    <div className="p-4 space-y-4">
      {/* Export Options */}
      <div>
        <h3 className="text-sm font-semibold mb-2">Export Calendar</h3>

        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={onExportImage}
            disabled={isExporting}
            className="flex items-center justify-center gap-2 p-3 rounded-lg border hover:bg-accent text-sm disabled:opacity-50"
          >
            <ImageIcon className="h-4 w-4" />
            Export as Image
          </button>

          <button
            onClick={onExportPDF}
            disabled={isExporting}
            className="flex items-center justify-center gap-2 p-3 rounded-lg border hover:bg-accent text-sm disabled:opacity-50"
          >
            <FileText className="h-4 w-4" />
            Export as PDF
          </button>
        </div>
      </div>

      {/* Calendar Feed URL */}
      <div>
        <h3 className="text-sm font-semibold mb-2">Calendar Feed URL</h3>

        <div className="p-3 rounded bg-muted/30">
          <p className="text-xs text-muted-foreground mb-2">
            Share this URL to let others subscribe to this calendar in their preferred app
          </p>

          <div className="flex items-center gap-2">
            <input
              type="text"
              value={feedUrl || 'https://calendar.marketinghub.com/feed/...'}
              readOnly
              className="flex-1 px-2 py-1.5 rounded bg-background text-xs font-mono"
            />
            <button
              onClick={onCopyFeedUrl}
              className="p-2 rounded hover:bg-accent"
              title="Copy to clipboard"
            >
              {feedUrl ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </div>

      {/* Integration Options */}
      <div>
        <h3 className="text-sm font-semibold mb-2">Integrations</h3>

        <div className="space-y-2">
          <IntegrationButton
            name="Google Calendar"
            description="Sync with Google Calendar"
            icon="📅"
          />
          <IntegrationButton
            name="Outlook Calendar"
            description="Sync with Outlook"
            icon="📊"
          />
          <IntegrationButton
            name="Apple Calendar"
            description="Sync with Apple Calendar"
            icon="🍎"
          />
        </div>
      </div>
    </div>
  );
}

// Integration Button
function IntegrationButton({
  name,
  description,
  icon,
}: {
  name: string;
  description: string;
  icon: string;
}) {
  return (
    <button className="w-full flex items-center gap-3 p-3 rounded-lg border hover:bg-accent text-left transition-colors">
      <span className="text-2xl">{icon}</span>
      <div className="flex-1">
        <div className="text-sm font-medium">{name}</div>
        <div className="text-xs text-muted-foreground">{description}</div>
      </div>
      <ChevronRight className="h-4 w-4 text-muted-foreground" />
    </button>
  );
}

// Format utility
import { format } from 'date-fns';
