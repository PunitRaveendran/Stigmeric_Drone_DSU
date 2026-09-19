import React, { useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import {
  Terminal,
  ChevronDown,
  ChevronUp,
  MessageSquare,
  List,
} from 'lucide-react';
import { useSimStore } from '../store/simStore.js';
import { Badge } from '../ui/Badge.jsx';

export function ConsoleDrawer() {
  const drawerOpen = useSimStore((s) => s.drawerOpen);
  const toggleDrawer = useSimStore((s) => s.toggleDrawer);
  const drawerTab = useSimStore((s) => s.drawerTab);
  const setDrawerTab = useSimStore((s) => s.setDrawerTab);

  const debateFeed = useSimStore((s) => s.debateFeed);
  const debateStats = useSimStore((s) => s.debateStats);
  const eventLog = useSimStore((s) => s.eventLog);

  const listParentRef = useRef(null);

  // Virtualizer for the active log feed
  const activeItems = drawerTab === 'debate' ? debateFeed : eventLog;

  const virtualizer = useVirtualizer({
    count: activeItems.length,
    getScrollElement: () => listParentRef.current,
    estimateSize: () => 28,
    overscan: 5,
  });

  return (
    <div className={`console-drawer ${drawerOpen ? 'is-open' : 'is-collapsed'}`}>
      {/* ─── Drawer Handle Bar (Always visible at bottom) ─────────────────── */}
      <div className="drawer-handle-bar" onClick={toggleDrawer} role="button" tabIndex={0}>
        <div className="drawer-handle-left">
          <Terminal size={14} className="drawer-handle-icon" />
          <span className="drawer-handle-title">MISSION CONSOLE & TELEMETRY STREAM</span>
          <span className="drawer-key-hint mono-num">[`]</span>
        </div>

        <div className="drawer-handle-center">
          <div className="drawer-pill-group" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className={`drawer-tab-btn ${drawerTab === 'debate' ? 'is-active' : ''}`}
              onClick={() => {
                setDrawerTab('debate');
                if (!drawerOpen) toggleDrawer();
              }}
            >
              <MessageSquare size={12} />
              <span>Debate ({(debateStats.proposals || 0) + (debateStats.agrees || 0) + (debateStats.rejects || 0) + (debateStats.consensusConfirmed || 0)})</span>
            </button>

            <button
              type="button"
              className={`drawer-tab-btn ${drawerTab === 'events' ? 'is-active' : ''}`}
              onClick={() => {
                setDrawerTab('events');
                if (!drawerOpen) toggleDrawer();
              }}
            >
              <List size={12} />
              <span>Events ({eventLog.length})</span>
            </button>
          </div>
        </div>

        <div className="drawer-handle-right">
          {drawerOpen ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
        </div>
      </div>

      {/* ─── Drawer Content Pane (Virtualized) ────────────────────────────── */}
      {drawerOpen && (
        <div className="drawer-content-pane">
          {/* Sub-header with debate metrics if on debate tab */}
          {drawerTab === 'debate' && (
            <div className="drawer-subbar">
              <div className="drawer-stat-row">
                <span className="subbar-label">CONSENSUS METRICS:</span>
                <Badge tone="accent">{debateStats.proposals} Proposals</Badge>
                <Badge tone="success">{debateStats.agrees} Agrees</Badge>
                <Badge tone="alert">{debateStats.rejects} Rejects</Badge>
                <Badge tone="warning">{debateStats.consensusConfirmed} Confirmed</Badge>
              </div>
            </div>
          )}

          <div ref={listParentRef} className="drawer-virtual-scroller">
            {activeItems.length === 0 ? (
              <div className="drawer-empty-state">
                Waiting for incoming swarm communications and telemetry...
              </div>
            ) : (
              <div
                style={{
                  height: `${virtualizer.getTotalSize()}px`,
                  width: '100%',
                  position: 'relative',
                }}
              >
                {virtualizer.getVirtualItems().map((virtualRow) => {
                  const item = activeItems[virtualRow.index];
                  if (!item) return null;

                  return (
                    <div
                      key={virtualRow.key}
                      className="virtual-row"
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: `${virtualRow.size}px`,
                        transform: `translateY(${virtualRow.start}px)`,
                      }}
                    >
                      {drawerTab === 'debate' ? (
                        <div className={`log-entry entry-${item.type}`}>
                          <span className="log-timestamp mono-num">t={item.tick}</span>
                          {item.badge && <span className={`log-badge-pill pill-${item.type}`}>{item.badge}</span>}
                          <span className="log-callsign mono-num">{item.callsign}</span>
                          <span className="log-text">{item.text}</span>
                        </div>
                      ) : (
                        <div className="log-entry entry-event">
                          <span className="log-timestamp mono-num">t={item.tick}</span>
                          <span className="log-badge-text">[{item.icon || 'INFO'}]</span>
                          <span className="log-text">{item.text}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
