import React, { useState } from 'react';
import { NavItem } from '../../components/navigation/NavItem.jsx';
import { Breadcrumb } from '../../components/navigation/Breadcrumb.jsx';
import { PageHeader } from '../../components/navigation/PageHeader.jsx';
import { Search } from '../../components/forms/Search.jsx';
import { Button } from '../../components/forms/Button.jsx';
import { IconButton } from '../../components/forms/IconButton.jsx';
import { Badge } from '../../components/data/Badge.jsx';
import { Card } from '../../components/data/Card.jsx';
import { Avatar } from '../../components/data/Avatar.jsx';
import { Icon } from '../../components/icon/Icon.jsx';

/**
 * The Discover view, composed entirely from design-system components.
 * Render inside an element carrying `class="sl-root" data-theme=…` so the
 * CSS variables resolve. See index.html for a standalone interactive version.
 */
export function DiscoverScreen() {
  const [open, setOpen] = useState('Class 4A');

  return (
    <div style={{ display: 'flex', height: '100%', minHeight: 560, border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden', background: 'var(--bg)' }}>
      {/* Sidebar */}
      <aside style={{ width: 198, flex: 'none', borderRight: '1px solid var(--border)', padding: '18px 12px', display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '4px 8px 16px' }}>
          <span style={{ width: 22, height: 22, borderRadius: 7, background: 'var(--primary)', color: 'var(--primary-fg)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="trophy" size={13} strokeWidth={2.4} />
          </span>
          <span style={{ font: '700 15px/1 var(--font-sans)', letterSpacing: '-0.2px' }}>Sports League</span>
        </div>
        <NavItem icon="grid">Overview</NavItem>
        <NavItem icon="compass" active>Discover</NavItem>
        <NavItem icon="users">Teams</NavItem>
        <NavItem icon="target">Players</NavItem>
        <NavItem icon="calendar">Seasons</NavItem>
        <NavItem icon="layers">Divisions</NavItem>
        <NavItem icon="upload">Import</NavItem>
        <NavItem icon="card">Billing</NavItem>
      </aside>

      {/* Main */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        {/* Topbar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, height: 54, flex: 'none', padding: '0 20px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, height: 36, padding: '0 12px', borderRadius: 9, border: '1px solid var(--border)', background: 'var(--surface)', font: '600 13px/1 var(--font-sans)' }}>
            <Icon name="trophy" size={14} />Cobb County Football<Icon name="chevron-vertical" size={14} strokeWidth={2} />
          </div>
          <div style={{ flex: 1, maxWidth: 340 }}><Search /></div>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
            <IconButton icon="sun" aria-label="Toggle theme" />
            <Avatar initials="AS" />
          </div>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflow: 'auto', padding: '22px 24px' }}>
          <div style={{ marginBottom: 12 }}>
            <Breadcrumb items={['Dashboard', 'Discover']} />
          </div>
          <PageHeader
            title="Discover Leagues"
            description="Browse leagues and add teams to your dashboard. Each team you add becomes your own private copy to manage."
          />

          <Card style={{ margin: '22px 0 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <Icon name="trophy" size={18} />
              <span style={{ font: '700 18px/1 var(--font-sans)' }}>Cobb County Football</span>
              <Badge variant="outline">Public</Badge>
            </div>

            <DivisionRow name="Class 4A" count={2} allAdded open={open === 'Class 4A'} onToggle={() => setOpen(open === 'Class 4A' ? null : 'Class 4A')} />
            {open === 'Class 4A' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, margin: '6px 0' }}>
                <TeamChip name="Allatoona" />
                <TeamChip name="Kell" />
              </div>
            )}
            <DivisionRow name="Class 5A" count={3} allAdded bordered open={false} onToggle={() => {}} />
            <DivisionRow name="Class 6A" count={11} allAdded bordered open={false} onToggle={() => {}} />
          </Card>

          <Card>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Icon name="trophy" size={18} />
                <span style={{ font: '700 18px/1 var(--font-sans)' }}>NFL</span>
                <Badge variant="outline">Public</Badge>
              </div>
              <Button size="sm">Add all (32)</Button>
            </div>
            <DivisionRow name="AFC East" count={4} bordered open={false} onToggle={() => {}} />
            <DivisionRow name="AFC North" count={4} bordered open={false} onToggle={() => {}} />
          </Card>
        </div>
      </div>
    </div>
  );
}

function DivisionRow({ name, count, allAdded, bordered, open, onToggle }) {
  return (
    <button
      onClick={onToggle}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%',
        padding: '12px 0', background: 'none', border: 'none', cursor: 'pointer',
        borderTop: bordered ? '1px solid var(--border)' : 'none', color: 'var(--text)', font: 'inherit',
      }}
    >
      <span style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
        <span style={{ font: '700 15px/1 var(--font-sans)' }}>{name}</span>
        <span style={{ font: '500 13px/1 var(--font-sans)', color: 'var(--text-subtle)' }}>({count})</span>
        {allAdded && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: 'var(--accent)', font: '600 12px/1 var(--font-sans)' }}>
            <Icon name="check-circle" size={13} strokeWidth={2.4} />All added
          </span>
        )}
      </span>
      <Icon name={open ? 'chevron-up' : 'chevron-down'} size={16} strokeWidth={2} style={{ color: 'var(--text-muted)' }} />
    </button>
  );
}

function TeamChip({ name }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', borderRadius: 'var(--r)', border: '1px solid var(--border)', background: 'var(--bg)' }}>
      <span style={{ font: '600 14px/1 var(--font-sans)' }}>{name}</span>
      <span style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--accent)', font: '600 12px/1 var(--font-sans)' }}>
          <Icon name="check-circle" size={13} strokeWidth={2.4} />Added
        </span>
        <span style={{ color: 'var(--text-subtle)', display: 'inline-flex', cursor: 'pointer' }}><Icon name="x" size={13} strokeWidth={2} /></span>
      </span>
    </div>
  );
}
