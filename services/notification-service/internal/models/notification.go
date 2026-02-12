// Package models provides data models for the Notification Service
package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// NotificationType represents the type of notification
type NotificationType string

const (
	NotificationTypeEmail   NotificationType = "email"
	NotificationTypeSMS     NotificationType = "sms"
	NotificationTypePush    NotificationType = "push"
	NotificationTypeInApp   NotificationType = "in_app"
	NotificationTypeWebhook NotificationType = "webhook"
)

// NotificationStatus represents the status of a notification
type NotificationStatus string

const (
	NotificationStatusPending   NotificationStatus = "pending"
	NotificationStatusQueued   NotificationStatus = "queued"
	NotificationStatusSent     NotificationStatus = "sent"
	NotificationStatusFailed   NotificationStatus = "failed"
	NotificationStatusDelivered NotificationStatus = "delivered"
	NotificationStatusBounced  NotificationStatus = "bounced"
)

// Notification represents a notification to be sent
type Notification struct {
	ID              uuid.UUID       `json:"id" gorm:"type:uuid;primary_key;default:uuid_generate_v4()"`
	UserID          string          `json:"user_id" gorm:"index;not null"`
	Type            NotificationType `json:"type" gorm:"type:varchar(20);not null;index"`
	Status          NotificationStatus `json:"status" gorm:"type:varchar(20);not null;default:'pending';index"`

	// Content
	Subject         string          `json:"subject" gorm:"type:varchar(500)"`
	Body            string          `json:"body" gorm:"type:text;not null"`
	Data            string          `json:"data" gorm:"type:jsonb"`

	// Template
	TemplateID      *uuid.UUID      `json:"template_id" gorm:"type:uuid;index"`

	// Recipients
	To              string          `json:"to" gorm:"type:varchar(500);not null"`
	From            *string         `json:"from" gorm:"type:varchar(500)"`

	// Scheduling
	ScheduledFor    *time.Time      `json:"scheduled_for" gorm:"index"`
	SentAt          *time.Time      `json:"sent_at"`
	DeliveredAt     *time.Time      `json:"delivered_at"`

	// Error handling
	ErrorCode       *string         `json:"error_code" gorm:"type:varchar(100)"`
	ErrorMessage    *string         `json:"error_message" gorm:"type:text"`
	RetryCount      int             `json:"retry_count" gorm:"default:0"`
	MaxRetries      int             `json:"max_retries" gorm:"default:3"`

	// Priority
	Priority        int             `json:"priority" gorm:"default:5;index"` // 1 = highest, 10 = lowest

	// Metadata
	CreatedAt       time.Time       `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt       time.Time       `json:"updated_at" gorm:"autoUpdateTime"`
	DeletedAt       gorm.DeletedAt `json:"-" gorm:"index"`

	// Relations
	Template        *NotificationTemplate `json:"template,omitempty" gorm:"foreignKey:TemplateID"`
	DeliveryReceipts []DeliveryReceipt  `json:"delivery_receipts,omitempty" gorm:"foreignKey:NotificationID"`
}

// NotificationTemplate represents a reusable notification template
type NotificationTemplate struct {
	ID              uuid.UUID       `json:"id" gorm:"type:uuid;primary_key;default:uuid_generate_v4()"`
	Name            string          `json:"name" gorm:"type:varchar(255);not null;uniqueIndex"`
	Description     *string         `json:"description" gorm:"type:text"`
	Type            NotificationType `json:"type" gorm:"type:varchar(20);not null;index"`

	// Template content
	SubjectTemplate string          `json:"subject_template" gorm:"type:varchar(500)"`
	BodyTemplate    string          `json:"body_template" gorm:"type:text;not null"`
	Variables       string          `json:"variables" gorm:"type:jsonb"` // JSON array of variable names

	// Default values
	From            *string         `json:"from" gorm:"type:varchar(500)"`
	ReplyTo         *string         `json:"reply_to" gorm:"type:varchar(500)"`

	// Metadata
	IsActive        bool            `json:"is_active" gorm:"default:true;index"`
	Language        string          `json:"language" gorm:"type:varchar(10);default:'en'"`

	// Ownership
	CreatedBy       string          `json:"created_by" gorm:"type:varchar(255);not null"`
	UpdatedBy       *string         `json:"updated_by" gorm:"type:varchar(255)"`

	// Timestamps
	CreatedAt       time.Time       `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt       time.Time       `json:"updated_at" gorm:"autoUpdateTime"`
	DeletedAt       gorm.DeletedAt `json:"-" gorm:"index"`

	// Relations
	Notifications   []Notification  `json:"notifications,omitempty" gorm:"foreignKey:TemplateID"`
}

// NotificationPreference represents user notification preferences
type NotificationPreference struct {
	ID              uuid.UUID       `json:"id" gorm:"type:uuid;primary_key;default:uuid_generate_v4()"`
	UserID          string          `json:"user_id" gorm:"index;not null;uniqueIndex:user_pref_type"`
	Type            NotificationType `json:"type" gorm:"type:varchar(20);not null;uniqueIndex:user_pref_type"`

	// Preferences
	Enabled         bool            `json:"enabled" gorm:"default:true"`
	QuietHours      bool            `json:"quiet_hours" gorm:"default:false"`
	QuietHoursStart *string         `json:"quiet_hours_start" gorm:"type:varchar(5)" // HH:MM format
	QuietHoursEnd   *string         `json:"quiet_hours_end" gorm:"type:varchar(5)"   // HH:MM format

	// Channel-specific preferences
	Email           *string         `json:"email" gorm:"type:varchar(255)"`
	Phone           *string         `json:"phone" gorm:"type:varchar(50)"`

	// Category preferences
	Categories      string          `json:"categories" gorm:"type:jsonb"` // JSON object with category: enabled mapping

	// Metadata
	CreatedAt       time.Time       `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt       time.Time       `json:"updated_at" gorm:"autoUpdateTime"`
}

// DeliveryReceipt represents delivery status for notifications
type DeliveryReceipt struct {
	ID              uuid.UUID       `json:"id" gorm:"type:uuid;primary_key;default:uuid_generate_v4()"`
	NotificationID  uuid.UUID       `json:"notification_id" gorm:"type:uuid;index;not null"`

	// Delivery status
	Status          NotificationStatus `json:"status" gorm:"type:varchar(20);not null;index"`

	// Provider info
	Provider        string          `json:"provider" gorm:"type:varchar(50);not null"` // sendgrid, twilio, fcm
	ProviderID      *string         `json:"provider_id" gorm:"type:varchar(255)" // Provider message ID

	// Response data
	Response        string          `json:"response" gorm:"type:jsonb"` // Full provider response

	// Timestamps
	SentAt          *time.Time      `json:"sent_at"`
	DeliveredAt     *time.Time      `json:"delivered_at"`
	OpenedAt        *time.Time      `json:"opened_at"`
	ClickedAt       *time.Time      `json:"clicked_at"`
	BouncedAt       *time.Time      `json:"bounced_at"`

	// Error info
	ErrorCode       *string         `json:"error_code" gorm:"type:varchar(100)"`
	ErrorMessage    *string         `json:"error_message" gorm:"type:text"`

	// Metadata
	CreatedAt       time.Time       `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt       time.Time       `json:"updated_at" gorm:"autoUpdateTime"`

	// Relations
	Notification    *Notification   `json:"notification,omitempty" gorm:"foreignKey:NotificationID"`
}

// TableName specifies the table name for Notification model
func (Notification) TableName() string {
	return "notifications"
}

// TableName specifies the table name for NotificationTemplate model
func (NotificationTemplate) TableName() string {
	return "notification_templates"
}

// TableName specifies the table name for NotificationPreference model
func (NotificationPreference) TableName() string {
	return "notification_preferences"
}

// TableName specifies the table name for DeliveryReceipt model
func (DeliveryReceipt) TableName() string {
	return "delivery_receipts"
}
