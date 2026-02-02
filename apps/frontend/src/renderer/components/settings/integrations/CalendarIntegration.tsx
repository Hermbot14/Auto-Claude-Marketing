import { Eye, EyeOff, Loader2, CheckCircle2, AlertCircle, Calendar } from 'lucide-react';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Switch } from '../../ui/switch';
import { Separator } from '../../ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../ui/select';
import type { ProjectEnvConfig, CalendarSyncStatus } from '../../../../shared/types';

interface CalendarIntegrationProps {
  envConfig: ProjectEnvConfig | null;
  updateEnvConfig: (updates: Partial<ProjectEnvConfig>) => void;
  showCalendarKey: boolean;
  setShowCalendarKey: React.Dispatch<React.SetStateAction<boolean>>;
  calendarConnectionStatus: CalendarSyncStatus | null;
  isCheckingCalendar: boolean;
}

/**
 * Calendar integration settings component.
 * Manages calendar API connection and sync settings for Google Calendar, Outlook, and other providers.
 */
export function CalendarIntegration({
  envConfig,
  updateEnvConfig,
  showCalendarKey,
  setShowCalendarKey,
  calendarConnectionStatus,
  isCheckingCalendar
}: CalendarIntegrationProps) {
  if (!envConfig) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <Label className="font-normal text-foreground">Enable Calendar Sync</Label>
          <p className="text-xs text-muted-foreground">
            Sync marketing campaigns and events with external calendars
          </p>
        </div>
        <Switch
          checked={envConfig.calendarEnabled || false}
          onCheckedChange={(checked) => updateEnvConfig({ calendarEnabled: checked })}
        />
      </div>

      {envConfig.calendarEnabled && (
        <>
          <div className="space-y-2">
            <Label className="text-sm font-medium text-foreground">Calendar Provider</Label>
            <p className="text-xs text-muted-foreground">
              Select your calendar service provider
            </p>
            <Select
              value={envConfig.calendarProvider || 'google'}
              onValueChange={(value: 'google' | 'outlook' | 'ical' | 'calDAV') =>
                updateEnvConfig({ calendarProvider: value })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select provider" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="google">Google Calendar</SelectItem>
                <SelectItem value="outlook">Microsoft Outlook</SelectItem>
                <SelectItem value="ical">iCal (.ics format)</SelectItem>
                <SelectItem value="calDAV">CalDAV server</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {(envConfig.calendarProvider === 'google' || envConfig.calendarProvider === 'outlook' || envConfig.calendarProvider === 'calDAV') && (
            <>
              <div className="space-y-2">
                <Label className="text-sm font-medium text-foreground">API Key or OAuth Token</Label>
                <p className="text-xs text-muted-foreground">
                  {envConfig.calendarProvider === 'google' && (
                    <>Get your API key from <a href="https://console.cloud.google.com" target="_blank" rel="noopener noreferrer" className="text-info hover:underline">Google Cloud Console</a></>
                  )}
                  {envConfig.calendarProvider === 'outlook' && (
                    <>Get your app registration from <a href="https://portal.azure.com" target="_blank" rel="noopener noreferrer" className="text-info hover:underline">Azure Portal</a></>
                  )}
                  {envConfig.calendarProvider === 'calDAV' && (
                    <>Enter your CalDAV server credentials</>
                  )}
                </p>
                <div className="relative">
                  <Input
                    type={showCalendarKey ? 'text' : 'password'}
                    placeholder="Enter API key or token"
                    value={envConfig.calendarApiKey || ''}
                    onChange={(e) => updateEnvConfig({ calendarApiKey: e.target.value })}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCalendarKey(!showCalendarKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showCalendarKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {envConfig.calendarProvider !== 'calDAV' && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-foreground">Calendar Email (Optional)</Label>
                  <p className="text-xs text-muted-foreground">
                    Email address associated with your calendar account
                  </p>
                  <Input
                    type="email"
                    placeholder="calendar@example.com"
                    value={envConfig.calendarEmail || ''}
                    onChange={(e) => updateEnvConfig({ calendarEmail: e.target.value })}
                  />
                </div>
              )}

              {envConfig.calendarApiKey && (
                <ConnectionStatus
                  isChecking={isCheckingCalendar}
                  connectionStatus={calendarConnectionStatus}
                />
              )}
            </>
          )}

          {envConfig.calendarProvider === 'ical' && (
            <div className="rounded-lg border border-info/30 bg-info/5 p-4">
              <div className="flex items-start gap-3">
                <Calendar className="h-5 w-5 text-info mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">iCal Import</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Export your calendar from Google, Outlook, or other providers as an .ics file,
                    then import it to sync your marketing events.
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-2"
                    onClick={() => {/* TODO: Implement iCal import */}}
                  >
                    Import iCal File
                  </Button>
                </div>
              </div>
            </div>
          )}

          <Separator />

          <AutoSyncToggle
            enabled={envConfig.calendarAutoSync || false}
            onToggle={(checked) => updateEnvConfig({ calendarAutoSync: checked })}
            provider={envConfig.calendarProvider || 'google'}
          />
        </>
      )}
    </div>
  );
}

interface ConnectionStatusProps {
  isChecking: boolean;
  connectionStatus: CalendarSyncStatus | null;
}

function ConnectionStatus({ isChecking, connectionStatus }: ConnectionStatusProps) {
  return (
    <div className="rounded-lg border border-border bg-muted/30 p-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-foreground">Connection Status</p>
          <p className="text-xs text-muted-foreground">
            {isChecking ? 'Checking...' :
              connectionStatus?.connected
                ? `Connected to ${connectionStatus.provider || 'calendar'}${connectionStatus.calendarName ? ` (${connectionStatus.calendarName})` : ''}`
                : connectionStatus?.error || 'Not connected'}
          </p>
          {connectionStatus?.connected && connectionStatus.eventCount !== undefined && (
            <p className="text-xs text-muted-foreground mt-1">
              {connectionStatus.eventCount} events available to sync
            </p>
          )}
          {connectionStatus?.connected && connectionStatus.lastSyncedAt && (
            <p className="text-xs text-muted-foreground mt-1">
              Last synced: {new Date(connectionStatus.lastSyncedAt).toLocaleString()}
            </p>
          )}
        </div>
        {isChecking ? (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        ) : connectionStatus?.connected ? (
          <CheckCircle2 className="h-4 w-4 text-success" />
        ) : (
          <AlertCircle className="h-4 w-4 text-warning" />
        )}
      </div>
    </div>
  );
}

interface AutoSyncToggleProps {
  enabled: boolean;
  onToggle: (checked: boolean) => void;
  provider: string;
}

function AutoSyncToggle({ enabled, onToggle, provider }: AutoSyncToggleProps) {
  const providerName = provider === 'google' ? 'Google Calendar' :
    provider === 'outlook' ? 'Outlook' :
    provider === 'ical' ? 'iCal' : 'CalDAV';

  return (
    <div className="flex items-center justify-between">
      <div className="space-y-0.5">
        <Label className="font-normal text-foreground">Auto-sync Events</Label>
        <p className="text-xs text-muted-foreground">
          Automatically sync events from {providerName} on project load
        </p>
      </div>
      <Switch checked={enabled} onCheckedChange={onToggle} />
    </div>
  );
}
