/**
 * Content Model
 *
 * Mongoose schema for content items in MongoDB.
 */

import mongoose, { Schema, Model, Document } from 'mongoose';

export interface IContent {
  _id: mongoose.Types.ObjectId;
  title: string;
  description?: string;
  type: 'post' | 'email' | 'ad' | 'social' | 'video' | 'other';
  status: 'draft' | 'pending_approval' | 'approved' | 'published' | 'archived';
  content: Record<string, any>;
  templateId?: mongoose.Types.ObjectId;
  campaignId?: mongoose.Types.ObjectId;
  tags: string[];
  metadata: Record<string, any>;
  createdBy: string;
  updatedBy?: string;
  publishedAt?: Date;
  scheduledFor?: Date;
  version: number;
  parentId?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export interface IContentVersion {
  _id: mongoose.Types.ObjectId;
  contentId: mongoose.Types.ObjectId;
  version: number;
  content: Record<string, any>;
  changes: string[];
  createdBy: string;
  createdAt: Date;
}

const contentSchema = new Schema<IContent>(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 255,
    },
    description: {
      type: String,
      trim: true,
    },
    type: {
      type: String,
      required: true,
      enum: ['post', 'email', 'ad', 'social', 'video', 'other'],
      index: true,
    },
    status: {
      type: String,
      required: true,
      enum: ['draft', 'pending_approval', 'approved', 'published', 'archived'],
      default: 'draft',
      index: true,
    },
    content: {
      type: Schema.Types.Mixed,
      required: true,
      default: {},
    },
    templateId: {
      type: Schema.Types.ObjectId,
      ref: 'Template',
      index: true,
    },
    campaignId: {
      type: Schema.Types.ObjectId,
      ref: 'Campaign',
      index: true,
    },
    tags: [{
      type: String,
      trim: true,
      lowercase: true,
    }],
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
    createdBy: {
      type: String,
      required: true,
      index: true,
    },
    updatedBy: {
      type: String,
      index: true,
    },
    publishedAt: {
      type: Date,
    },
    scheduledFor: {
      type: Date,
      index: true,
    },
    version: {
      type: Number,
      default: 1,
    },
    parentId: {
      type: Schema.Types.ObjectId,
      ref: 'Content',
      index: true,
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
    },
    toObject: {
      virtuals: true,
    },
  }
);

// Indexes
contentSchema.index({ title: 'text', description: 'text', 'content.body': 'text' });
contentSchema.index({ createdAt: -1 });
contentSchema.index({ scheduledFor: 1, status: 1 });

// Virtual for versions
contentSchema.virtual('versions', {
  ref: 'ContentVersion',
  localField: '_id',
  foreignField: 'contentId',
});

// Pre-save middleware to create version
contentSchema.pre('save', async function(this: IContent & Document, next) {
  if (this.isModified('content') && !this.isNew) {
    this.version += 1;
  }
  next();
});

// Post-save middleware to archive version
contentSchema.post('save', async function(this: IContent & Document) {
  if (this.version > 1) {
    const ContentVersion = mongoose.model('ContentVersion');
    await ContentVersion.create({
      contentId: this._id,
      version: this.version,
      content: this.content,
      changes: [], // Could track specific changes
      createdBy: this.updatedBy || this.createdBy,
    });
  }
});

export const Content: Model<IContent> = mongoose.model<IContent>('Content', contentSchema);

const contentVersionSchema = new Schema<IContentVersion>(
  {
    contentId: {
      type: Schema.Types.ObjectId,
      ref: 'Content',
      required: true,
      index: true,
    },
    version: {
      type: Number,
      required: true,
    },
    content: {
      type: Schema.Types.Mixed,
      required: true,
    },
    changes: [{
      type: String,
    }],
    createdBy: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

contentVersionSchema.index({ contentId: 1, version: -1 });

export const ContentVersion: Model<IContentVersion> = mongoose.model<IContentVersion>(
  'ContentVersion',
  contentVersionSchema
);
