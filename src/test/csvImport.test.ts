import { describe, it, expect } from 'vitest';
import { parseCSV } from '@/lib/csvImport';

const HEADER =
  'Course Name,Component Name,Component Weight (%),Drop Lowest,Downweight Count,Downweight %,Sub-component Name,Grade';

const csv = (...rows: string[]) => [HEADER, ...rows].join('\n');

describe('parseCSV', () => {
  it('parses a single course, component and sub-component', () => {
    const [course] = parseCSV(csv('CPSC 121,Assignments,30,,,,A1,92'));

    expect(course.name).toBe('CPSC 121');
    expect(course.components).toHaveLength(1);
    expect(course.components[0]).toMatchObject({ name: 'Assignments', weight: 30 });
    expect(course.components[0].subComponents).toMatchObject([{ name: 'A1', grade: 92 }]);
  });

  it('carries the course and component forward across blank cells', () => {
    const [course] = parseCSV(
      csv('CPSC 121,Assignments,30,,,,A1,92', ',,,,,,A2,85', ',,,,,,A3,78')
    );

    expect(course.components).toHaveLength(1);
    expect(course.components[0].subComponents.map(s => s.name)).toEqual(['A1', 'A2', 'A3']);
  });

  it('groups multiple components under one course', () => {
    const [course] = parseCSV(
      csv('CPSC 121,Assignments,40,,,,A1,92', ',Final,60,,,,Exam,78')
    );

    expect(course.components.map(c => c.name)).toEqual(['Assignments', 'Final']);
    expect(course.components.map(c => c.weight)).toEqual([40, 60]);
  });

  it('separates distinct courses', () => {
    const courses = parseCSV(
      csv('CPSC 121,Assignments,100,,,,A1,92', 'MATH 200,Homework,100,,,,H1,88')
    );

    expect(courses.map(c => c.name)).toEqual(['CPSC 121', 'MATH 200']);
  });

  it('round-trips the advanced grading policies', () => {
    const [dropped] = parseCSV(csv('C,Assignments,30,2,,,A1,90'));
    expect(dropped.components[0]).toMatchObject({
      dropLowestCount: 2,
      downweightLowestCount: null,
      downweightPercent: null,
    });

    const [downweighted] = parseCSV(csv('C,Assignments,30,,1,50,A1,90'));
    expect(downweighted.components[0]).toMatchObject({
      dropLowestCount: null,
      downweightLowestCount: 1,
      downweightPercent: 50,
    });
  });

  it('honours quoted fields containing commas', () => {
    const [course] = parseCSV(csv('"Smith, J. - CPSC 121",Assignments,30,,,,A1,92'));
    expect(course.name).toBe('Smith, J. - CPSC 121');
  });

  it('unescapes doubled quotes', () => {
    const [course] = parseCSV(csv('C,Assignments,30,,,,"The ""Big"" One",92'));
    expect(course.components[0].subComponents[0].name).toBe('The "Big" One');
  });

  it('maps columns by header name when they are reordered', () => {
    const reordered = [
      'Grade,Sub-component Name,Course Name,Component Name,Component Weight (%),Drop Lowest,Downweight Count,Downweight %',
      '92,A1,CPSC 121,Assignments,30,,,',
    ].join('\n');

    const [course] = parseCSV(reordered);
    expect(course.name).toBe('CPSC 121');
    expect(course.components[0]).toMatchObject({ name: 'Assignments', weight: 30 });
    expect(course.components[0].subComponents[0]).toMatchObject({ name: 'A1', grade: 92 });
  });

  it('tolerates unknown extra columns', () => {
    const withExtra = [`${HEADER},Notes`, 'CPSC 121,Assignments,30,,,,A1,92,ignore me'].join('\n');
    const [course] = parseCSV(withExtra);
    expect(course.components[0].subComponents[0]).toMatchObject({ name: 'A1', grade: 92 });
  });

  it('clamps out-of-range grades', () => {
    const [course] = parseCSV(csv('C,A,10,,,,High,150', ',,,,,,Low,-30'));
    expect(course.components[0].subComponents.map(s => s.grade)).toEqual([100, 0]);
  });

  it('treats a blank grade as unentered rather than zero', () => {
    const [course] = parseCSV(csv('C,A,10,,,,Ungraded,'));
    expect(course.components[0].subComponents[0].grade).toBeNull();
  });

  it('gives a component with no rows one empty sub-component', () => {
    const [course] = parseCSV(csv('C,Participation,10,,,,,'));
    expect(course.components[0].subComponents).toMatchObject([{ name: '', grade: null }]);
  });

  it('skips entirely blank lines', () => {
    const [course] = parseCSV(csv('C,A,10,,,,A1,92', ',,,,,,,', ',,,,,,A2,88'));
    expect(course.components[0].subComponents).toHaveLength(2);
  });

  it('returns no courses for a header-only file', () => {
    expect(parseCSV(HEADER)).toEqual([]);
  });

  it('assigns unique ids and wires up parent references', () => {
    const [course] = parseCSV(csv('C,A,10,,,,A1,92', ',,,,,,A2,88'));
    const component = course.components[0];

    expect(component.courseId).toBe(course.id);
    expect(component.subComponents.every(s => s.componentId === component.id)).toBe(true);
    expect(new Set(component.subComponents.map(s => s.id)).size).toBe(2);
  });
});
