import { describe, it, expect } from 'vitest';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Course } from '@/types/grades';
import { buildReportRows } from '@/lib/pdfExport';

const course: Course = {
  id: 'course-1',
  name: 'CPSC 121',
  breakdowns: [
    {
      id: 'b-1',
      courseId: 'course-1',
      name: 'Assignments',
      weight: 40,
      dropLowestCount: 1,
      downweightLowestCount: null,
      downweightPercent: null,
      subBreakdownLabel: 'Assignment',
      subBreakdowns: [
        { id: 's1', breakdownId: 'b-1', name: 'Assignment 1', achievedMarks: 4, fullMarks: 10 },
        { id: 's2', breakdownId: 'b-1', name: 'Assignment 2', achievedMarks: 18, fullMarks: 20 },
        { id: 's3', breakdownId: 'b-1', name: 'Assignment 3', achievedMarks: 10, fullMarks: 10 },
      ],
    },
  ],
};

describe('buildReportRows', () => {
  it('emits one row per sub-breakdown', () => {
    expect(buildReportRows(course)).toHaveLength(3);
  });

  it('prints the parent columns only on the first row', () => {
    const [first, second, third] = buildReportRows(course);

    // Drop lowest 1 removes 4/10, leaving 28/30 = 93.3%, weighted by 40% -> 37.3%
    expect(first).toEqual([
      'Assignments',
      '40%',
      'Drop lowest 1',
      'Assignment 1',
      '4 / 10',
      '93.3%',
      '37.3%',
    ]);
    expect(second).toEqual(['', '', '', 'Assignment 2', '18 / 20', '', '']);
    expect(third).toEqual(['', '', '', 'Assignment 3', '10 / 10', '', '']);
  });

  it('shows marks as achieved over full', () => {
    expect(buildReportRows(course)[1][4]).toBe('18 / 20');
  });

  it('shows a dash for unentered marks but keeps the full marks', () => {
    const ungraded: Course = {
      ...course,
      breakdowns: [
        {
          ...course.breakdowns[0],
          subBreakdowns: [
            { id: 's1', breakdownId: 'b-1', name: 'A1', achievedMarks: null, fullMarks: 25 },
          ],
        },
      ],
    };
    expect(buildReportRows(ungraded)[0][4]).toBe('- / 25');
  });

  it('describes the downweight policy', () => {
    const downweighted: Course = {
      ...course,
      breakdowns: [
        {
          ...course.breakdowns[0],
          dropLowestCount: null,
          downweightLowestCount: 2,
          downweightPercent: 25,
        },
      ],
    };
    expect(buildReportRows(downweighted)[0][2]).toBe('Downweight lowest 2 by 25%');
  });

  it('shows a dash where no policy applies', () => {
    const plain: Course = {
      ...course,
      breakdowns: [{ ...course.breakdowns[0], dropLowestCount: null }],
    };
    expect(buildReportRows(plain)[0][2]).toBe('-');
  });

  it('shows a dash for an unset weight', () => {
    const unweighted: Course = {
      ...course,
      breakdowns: [{ ...course.breakdowns[0], weight: null }],
    };
    expect(buildReportRows(unweighted)[0][1]).toBe('-');
  });

  it('is empty for a course with no breakdowns', () => {
    expect(buildReportRows({ ...course, breakdowns: [] })).toEqual([]);
  });
});

describe('autoTable cursor contract', () => {
  it('populates lastAutoTable.finalY, which the report relies on for spacing', () => {
    // pdfExport reads this to position the next course. If the plugin ever stops
    // setting it, that access silently falls back and courses would overlap.
    const doc = new jsPDF();
    autoTable(doc, { startY: 40, head: [['A']], body: [['1']] });

    const finalY = (doc as jsPDF & { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY;
    expect(typeof finalY).toBe('number');
    expect(finalY).toBeGreaterThan(40);
  });
});
