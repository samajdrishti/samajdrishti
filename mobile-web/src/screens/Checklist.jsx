import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useInspection, CHECKLIST_SECTIONS, CHECKLIST_ITEMS } from '../context/InspectionContext';
import { TopBar, Panel, Bar, Note, Chip, Empty } from '../components/ui';

const MARKS = [
  { v: 'verified', icon: '✓', cls: 'on-ok', label: 'Verified' },
  { v: 'issue', icon: '▲', cls: 'on-warn', label: 'Issue' },
  { v: 'critical', icon: '✕', cls: 'on-bad', label: 'Critical' },
];

const Checklist = () => {
  const { session, setCheck, checklistDone, checklistTotal } = useInspection();
  const navigate = useNavigate();
  const [query, setQuery] = React.useState('');
  const [collapsed, setCollapsed] = React.useState({});

  const flagged = CHECKLIST_ITEMS.filter((i) => ['issue', 'critical'].includes(session.checklist[i.id]));
  const pct = checklistTotal ? (checklistDone / checklistTotal) * 100 : 0;
  const q = query.trim().toLowerCase();
  const visibleSections = CHECKLIST_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) =>
      !q || item.label.toLowerCase().includes(q) || item.hint.toLowerCase().includes(q)
    ),
  })).filter((section) => section.items.length > 0);

  const toggleSection = (id) => setCollapsed((c) => ({ ...c, [id]: !c[id] }));

  return (
    <>
      <TopBar
        title="Inspection Checklist"
        subtitle="DoSJE prescribed compliance points"
        onBack={() => navigate('/inspection/run')}
        right={<Chip tone={checklistDone === checklistTotal ? 'ok' : 'warn'}>{checklistDone}/{checklistTotal}</Chip>}
      />

      <div className="g-panel-bd stack" style={{ gap: 14 }}>
        <Panel>
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span className="g-h2">{checklistDone} / {checklistTotal} checks completed</span>
            <span className="g-h3" style={{ color: 'var(--navy)' }}>{Math.round(pct)}%</span>
          </div>
          <div className="mt" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100} aria-label="Checklist completion">
            <Bar pct={pct} tone={pct === 100 ? 'ok' : 'warn'} />
          </div>
          <div className="row" style={{ gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
            <Chip tone="ok">{CHECKLIST_ITEMS.filter((i) => session.checklist[i.id] === 'verified').length} verified</Chip>
            <Chip tone="warn">{flagged.filter((f) => session.checklist[f.id] === 'issue').length} issue</Chip>
            <Chip tone="bad">{flagged.filter((f) => session.checklist[f.id] === 'critical').length} critical</Chip>
          </div>
          <div className="mt">
            <label className="sr-only" htmlFor="checklist-search">Search checklist</label>
            <input
              id="checklist-search"
              className="input"
              type="search"
              placeholder="Search checks… (e.g. fire, register)"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </Panel>

        {visibleSections.length === 0 ? (
          <Panel>
            <Empty icon="🔍" title="No checks match" desc={`Nothing matches “${query}”. Clear the search to see all ${checklistTotal} points.`} />
          </Panel>
        ) : null}

        {visibleSections.map((section) => {
          const done = section.items.filter((i) => session.checklist[i.id]).length;
          const isCollapsed = Boolean(collapsed[section.id]);
          return (
            <Panel
              key={section.id}
              title={section.title}
              aside={
                <button
                  type="button"
                  className="g-topbar-btn"
                  style={{ width: 'auto', padding: '0 10px', fontSize: 11.5 }}
                  onClick={() => toggleSection(section.id)}
                  aria-expanded={!isCollapsed}
                  aria-label={`${isCollapsed ? 'Expand' : 'Collapse'} ${section.title}`}
                >
                  {done}/{section.items.length} {isCollapsed ? '▸' : '▾'}
                </button>
              }
              pad={false}
            >
              {isCollapsed ? null : (
                <div className="g-panel-bd">
                  {section.items.map((item) => {
                    const value = session.checklist[item.id];
                    return (
                      <div key={item.id} className="g-chk">
                        <div className="g-chk-main">
                          <div className="g-chk-t">{item.label}</div>
                          <div className="g-chk-m">{item.hint}</div>
                          <div className="g-chk-acts" role="radiogroup" aria-label={item.label}>
                            {MARKS.map((m) => (
                              <button
                                key={m.v}
                                type="button"
                                role="radio"
                                aria-checked={value === m.v}
                                title={m.label}
                                className={`g-mark ${value === m.v ? m.cls : ''}`}
                                onClick={() => setCheck(item.id, value === m.v ? null : m.v)}
                                aria-label={`${m.label}: ${item.label}`}
                              >
                                {m.icon}
                              </button>
                            ))}
                            <button
                              type="button"
                              className="g-mark"
                              onClick={() => navigate('/evidence/capture')}
                              aria-label={`Attach photo for ${item.label}`}
                              title="Attach photo"
                            >
                              📷
                            </button>
                            {value ? <Chip tone={value === 'verified' ? 'ok' : value === 'issue' ? 'warn' : 'bad'}>{value}</Chip> : null}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Panel>
          );
        })}

        {checklistDone === 0 && !q ? (
          <Empty icon="☑️" title="Nothing marked yet" desc="Mark each point verified, issue or critical. Unmarked points are carried into the report as not inspected." />
        ) : null}

        {flagged.length ? (
          <Note tone="warn" icon="▲">
            {flagged.length} flagged point{flagged.length === 1 ? '' : 's'} will be listed in the report summary
            and sent to the institution as part of the Action Taken Report.
          </Note>
        ) : null}

        <button
          className="g-btn g-btn-primary"
          onClick={() => navigate('/ai')}
        >
          CONTINUE TO AI ANALYSIS
        </button>
      </div>
    </>
  );
};

export default Checklist;
