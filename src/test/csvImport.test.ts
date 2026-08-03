import { describe, it, expect } from 'vitest';
import { parseCSV } from '@/lib/csvImport';

const HEADER =
  'Course Name,Breakdown Name,Breakdown Weight (%),Drop Lowest,Downweight Count,Downweight %,Sub-breakdown Name,Marks Achieved,Full Marks';

/** The pre-"breakdown" header row, still produced by older exports. */
const LEGACY_HEADER =
  'Course Name,Component Name,Component Weight (%),Drop Lowest,Downweight Count,Downweight %,Sub-component Name,Grade';

const csv = (...rows: string[]) => [HEADER, ...rows].join('\n');
const legacyCsv = (...rows: string[]) => [LEGACY_HEADER, ...rows].join('\n');

describe('parseCSV', () => {
  it('parses a single course, breakdown and sub-breakdown', () => {
    const [course] = parseCSV(csv('CPSC 121,Assignments,30,,,,A1,18,20'));

    expect(course.name).toBe('CPSC 121');
    expect(course.breakdowns).toHaveLength(1);
    expect(course.breakdowns[0]).toMatchObject({ name: 'Assignments', weight: 30 });
    expect(course.breakdowns[0].subBreakdowns).toMatchObject([
      { name: 'A1', achievedMarks: 18, fullMarks: 20 },
    ]);
  });

  it('carries the course and breakdown forward across blank cells', () => {
    const [course] = parseCSV(
      csv('CPSC 121,Assignments,30,,,,A1,18,20', ',,,,,,A2,17,20', ',,,,,,A3,15,20')
    );

    expect(course.breakdowns).toHaveLength(1);
    expect(course.breakdowns[0].subBreakdowns.map(s => s.name)).toEqual(['A1', 'A2', 'A3']);
  });

  it('groups multiple breakdowns under one course', () => {
    const [course] = parseCSV(
      csv('CPSC 121,Assignments,40,,,,A1,18,20', ',Final Exam,60,,,,Exam,78,100')
    );

    expect(course.breakdowns.map(b => b.name)).toEqual(['Assignments', 'Final Exam']);
    expect(course.breakdowns.map(b => b.weight)).toEqual([40, 60]);
  });

  it('separates distinct courses', () => {
    const courses = parseCSV(
      csv('CPSC 121,Assignments,100,,,,A1,9,10', 'MATH 200,Homework,100,,,,H1,8,10')
    );

    expect(courses.map(c => c.name)).toEqual(['CPSC 121', 'MATH 200']);
  });

  it('round-trips the advanced grading policies', () => {
    const [dropped] = parseCSV(csv('C,Assignments,30,2,,,A1,9,10'));
    expect(dropped.breakdowns[0]).toMatchObject({
      dropLowestCount: 2,
      downweightLowestCount: null,
      downweightPercent: null,
    });

    const [downweighted] = parseCSV(csv('C,Assignments,30,,1,50,A1,9,10'));
    expect(downweighted.breakdowns[0]).toMatchObject({
      dropLowestCount: null,
      downweightLowestCount: 1,
      downweightPercent: 50,
    });
  });

  it('derives the sub-breakdown label from a recognised preset', () => {
    const [course] = parseCSV(csv('C,Quizzes,30,,,,Q1,9,10'));
    expect(course.breakdowns[0].subBreakdownLabel).toBe('Quiz');
  });

  it('falls back to the name itself for a custom breakdown', () => {
    const [course] = parseCSV(csv('C,Reading Responses,30,,,,R1,9,10'));
    expect(course.breakdowns[0].subBreakdownLabel).toBe('Reading Responses');
  });

  it('honours quoted fields containing commas', () => {
    const [course] = parseCSV(csv('"Smith, J. - CPSC 121",Assignments,30,,,,A1,9,10'));
    expect(course.name).toBe('Smith, J. - CPSC 121');
  });

  it('unescapes doubled quotes', () => {
    const [course] = parseCSV(csv('C,Assignments,30,,,,"The ""Big"" One",9,10'));
    expect(course.breakdowns[0].subBreakdowns[0].name).toBe('The "Big" One');
  });

  it('maps columns by header name when they are reordered', () => {
    const reordered = [
      'Full Marks,Marks Achieved,Sub-breakdown Name,Course Name,Breakdown Name,Breakdown Weight (%),Drop Lowest,Downweight Count,Downweight %',
      '20,18,A1,CPSC 121,Assignments,30,,,',
    ].join('\n');

    const [course] = parseCSV(reordered);
    expect(course.name).toBe('CPSC 121');
    expect(course.breakdowns[0]).toMatchObject({ name: 'Assignments', weight: 30 });
    expect(course.breakdowns[0].subBreakdowns[0]).toMatchObject({
      name: 'A1',
      achievedMarks: 18,
      fullMarks: 20,
    });
  });

  it('tolerates unknown extra columns', () => {
    const withExtra = [`${HEADER},Notes`, 'CPSC 121,Assignments,30,,,,A1,18,20,ignore me'].join(
      '\n'
    );
    const [course] = parseCSV(withExtra);
    expect(course.breakdowns[0].subBreakdowns[0]).toMatchObject({
      name: 'A1',
      achievedMarks: 18,
    });
  });

  it('imports marks verbatim, without correcting them', () => {
    const [course] = parseCSV(csv('C,A,10,,,,Bonus,25,20', ',,,,,,Negative,-30,20'));
    expect(course.breakdowns[0].subBreakdowns.map(s => s.achievedMarks)).toEqual([25, -30]);
  });

  it('leaves blank full marks unset rather than defaulting to 100', () => {
    const [course] = parseCSV(csv('C,A,10,,,,Unset,18,'));
    expect(course.breakdowns[0].subBreakdowns[0]).toMatchObject({
      achievedMarks: 18,
      fullMarks: null,
    });
  });

  it('treats blank marks as unentered rather than zero', () => {
    const [course] = parseCSV(csv('C,A,10,,,,Ungraded,,20'));
    expect(course.breakdowns[0].subBreakdowns[0].achievedMarks).toBeNull();
  });

  it('gives a breakdown with no rows one auto-named sub-breakdown', () => {
    const [course] = parseCSV(csv('C,Labs,10,,,,,,'));
    expect(course.breakdowns[0].subBreakdowns).toMatchObject([
      { name: 'Lab 1', achievedMarks: null, fullMarks: null },
    ]);
  });

  it('skips entirely blank lines', () => {
    const [course] = parseCSV(csv('C,A,10,,,,A1,9,10', ',,,,,,,,', ',,,,,,A2,8,10'));
    expect(course.breakdowns[0].subBreakdowns).toHaveLength(2);
  });

  it('returns no courses for a header-only file', () => {
    expect(parseCSV(HEADER)).toEqual([]);
  });

  it('assigns unique ids and wires up parent references', () => {
    const [course] = parseCSV(csv('C,A,10,,,,A1,9,10', ',,,,,,A2,8,10'));
    const breakdown = course.breakdowns[0];

    expect(breakdown.courseId).toBe(course.id);
    expect(breakdown.subBreakdowns.every(s => s.breakdownId === breakdown.id)).toBe(true);
    expect(new Set(breakdown.subBreakdowns.map(s => s.id)).size).toBe(2);
  });

  describe('legacy files exported before the breakdown rename', () => {
    it('reads the old component/grade headers', () => {
      const [course] = parseCSV(legacyCsv('CPSC 121,Assignments,30,,,,A1,92'));

      expect(course.name).toBe('CPSC 121');
      expect(course.breakdowns[0]).toMatchObject({ name: 'Assignments', weight: 30 });
      expect(course.breakdowns[0].subBreakdowns[0]).toMatchObject({
        name: 'A1',
        achievedMarks: 92,
      });
    });

    it('defaults full marks to 100, so old percentages keep their meaning', () => {
      const [course] = parseCSV(legacyCsv('C,Assignments,100,,,,A1,92', ',,,,,,A2,88'));
      const subs = course.breakdowns[0].subBreakdowns;

      expect(subs.map(s => s.fullMarks)).toEqual([100, 100]);
      expect(subs.map(s => s.achievedMarks)).toEqual([92, 88]);
    });

    it('still carries parent columns forward', () => {
      const [course] = parseCSV(legacyCsv('C,Assignments,100,,,,A1,92', ',,,,,,A2,88'));
      expect(course.breakdowns).toHaveLength(1);
      expect(course.breakdowns[0].subBreakdowns).toHaveLength(2);
    });
  });
});
