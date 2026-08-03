import { describe, it, expect } from 'vitest';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Course } from '@/types/grades';
import { buildReportRows } from '@/lib/pdfExport';

const course: Course = {
  id: 'course-1',
  name: 'CPSC 121',
  components: [
    {
      id: 'comp-1',
      courseId: 'course-1',
      name: 'Assignments',
      weight: 40,
      dropLowestCount: 1,
      downweightLowestCount: null,
      downweightPercent: null,
      subComponents: [
        { id: 's1', componentId: 'comp-1', name: 'A1', grade: 60 },
        { id: 's2', componentId: 'comp-1', name: 'A2', grade: 80 },
        { id: 's3', componentId: 'comp-1', name: 'A3', grade: 100 },
      ],
    },
  ],
};

describe('buildReportRows', () => {
  it('emits one row per sub-component', () => {
    expect(buildReportRows(course)).toHaveLength(3);
  });

  it('prints the parent columns only on the first row', () => {
    const [first, second, third] = buildReportRows(course);

    // Drop lowest 1 of [60,80,100] -> 90, weighted by 40% -> 36.0
    expect(first).toEqual([
      'Assignments',
      '40%',
      'Drop lowest 1',
      'A1',
      '60%',
      '90.0%',
      '36.0%',
    ]);
    expect(second).toEqual(['', '', '', 'A2', '80%', '', '']);
    expect(third).toEqual(['', '', '', 'A3', '100%', '', '']);
  });

  it('describes the downweight policy', () => {
    const downweighted: Course = {
      ...course,
      components: [
        {
          ...course.components[0],
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
      components: [{ ...course.components[0], dropLowestCount: null }],
    };
    expect(buildReportRows(plain)[0][2]).toBe('-');
  });

  it('shows a dash for an unentered grade and an unset weight', () => {
    const sparse: Course = {
      ...course,
      components: [
        {
          ...course.components[0],
          weight: null,
          dropLowestCount: null,
          subComponents: [{ id: 's1', componentId: 'comp-1', name: 'A1', grade: null }],
        },
      ],
    };
    expect(sparse.components[0].subComponents).toHaveLength(1);
    expect(buildReportRows(sparse)[0]).toEqual(['Assignments', '-', '-', 'A1', '-', '-', '-']);
  });

  it('is empty for a course with no components', () => {
    expect(buildReportRows({ ...course, components: [] })).toEqual([]);
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
