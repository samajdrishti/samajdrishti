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
  const { session, setCheck, checklistDone } = useInspection();
  const navigate = useNavigate();

  const flagged = CHECKLIST_ITEMS.filter((i) => ['issue', 'critical'].includes(session.checklist[i.id]));
  const pct = (checklistDone / CHECKLIST_ITEMS.length) * 100;

  return (
    <>
      <TopBar
        title="Inspection Checklist"
        subtitle="DoSJE prescribed compliance points"
        onBack={() => navigate('/inspection/run')}
        right={<Chip tone={checklistDone === CHECKLIST_ITEMS.length ? 'ok' : 'warn'}>{checklistDone}/{CHECKLIST_ITEMS.length}</Chip>}
      />

      <div className="g-panel-bd stack" style={{ gap: 14 }}>
        <Panel>
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span className="g-h2">{checklistDone} / {CHECKLIST_ITEMS.length} checks completed</span>
            <span className="g-h3" style={{ color: 'var(--navy)' }}>{Math.round(pct)}%</span>
          </div>
          <div className="mt"><Bar pct={pct} tone={pct === 100 ? 'ok' : 'warn'} /></div>
          {flagged.length ? (
            <div className="divider" />
          ) : null}
          <div className="row" style={{ gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
            <Chip tone="ok">{CHECKLIST_ITEMS.filter((i) => session.checklist[i.id] === 'verified').length} verified</Chip>
            <Chip tone="warn">{flagged.filter((f) => session.checklist[f.id] === 'issue').length} issue</Chip>
            <Chip tone="bad">{flagged.filter((f) => session.checklist[f.id] === 'critical').length} critical</Chip>
          </div>
        </Panel>

        {CHECKLIST_SECTIONS.map((section) => {
          const done = section.items.filter((i) => session.checklist[i.id]).length;
          return (
            <Panel
              key={section.id}
              title={section.title}
              aside={<span className="g-sec-aside">{done}/{section.items.length}</span>}
              pad={false}
            >
              <div className="g-panel-bd">
                {section.items.map((item) => {
                  const value = session.checklist[item.id];
                  return (
                    <div key={item.id} className="g-chk">
                      <div className="g-chk-main">
                        <div className="g-chk-t">{item.label}</div>
                        <div className="g-chk-m">{item.hint}</div>
                        <div className="g-chk-acts">
                          {MARKS.map((m) => (
                            <button
                              key={m.v}
                              type="button"
                              className={`g-mark ${value === m.v ? m.cls : ''}`}
                              onClick={() => setCheck(item.id, value === m.v ? null : m.v)}
                              aria-label={m.label}
                            >
                              {m.icon}
                            </button>
                          ))}
                          <button
                            type="button"
                            className="g-mark"
                            onClick={() => navigate('/evidence/capture')}
                            aria-label="Add photo"
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
            </Panel>
          );
        })}

        {checklistDone === 0 ? (
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
          onClick={() => navigate(checklistDone ? '/ai' : '/ai')}
        >
          CONTINUE
        </button>
      </div>
    </>
  );
};

export default Checklist;
