import { Component, SubComponent } from '@/types/grades';

export function calculateSubComponentGrades(subComponents: SubComponent[]): number[] {
  return subComponents
    .filter(sc => sc.grade !== null)
    .map(sc => sc.grade as number);
}

export function calculateComponentGrade(component: Component): number | null {
  const grades = calculateSubComponentGrades(component.subComponents);
  
  if (grades.length === 0) return null;
  
  // If only one grade, no drop/downweight effect
  if (grades.length === 1) return grades[0];
  
  // Sort grades ascending for drop/downweight operations
  const sortedGrades = [...grades].sort((a, b) => a - b);
  
  // Option 1: Drop Lowest
  if (component.dropLowestCount !== null && component.dropLowestCount > 0) {
    const dropCount = Math.min(component.dropLowestCount, grades.length - 1);
    const keptGrades = sortedGrades.slice(dropCount);
    return keptGrades.reduce((sum, g) => sum + g, 0) / keptGrades.length;
  }
  
  // Option 2: Downweight Lowest
  if (
    component.downweightLowestCount !== null && 
    component.downweightLowestCount > 0 &&
    component.downweightPercent !== null
  ) {
    const downweightCount = Math.min(component.downweightLowestCount, grades.length);
    const downweightMultiplier = 1 - component.downweightPercent / 100;
    
    let weightedSum = 0;
    let totalWeight = 0;
    
    sortedGrades.forEach((grade, index) => {
      const weight = index < downweightCount ? downweightMultiplier : 1;
      weightedSum += grade * weight;
      totalWeight += weight;
    });
    
    return totalWeight > 0 ? weightedSum / totalWeight : null;
  }
  
  // Default: Simple mean
  return grades.reduce((sum, g) => sum + g, 0) / grades.length;
}

export function calculateWeightedValue(component: Component): number | null {
  const componentGrade = calculateComponentGrade(component);
  if (componentGrade === null || component.weight === null) return null;
  return (componentGrade * component.weight) / 100;
}

export function calculateCourseGrade(components: Component[]): number | null {
  let totalWeightedGrade = 0;
  let hasAnyGrade = false;
  
  for (const component of components) {
    const componentGrade = calculateComponentGrade(component);
    if (componentGrade !== null && component.weight !== null) {
      totalWeightedGrade += componentGrade * component.weight / 100;
      hasAnyGrade = true;
    }
  }
  
  if (!hasAnyGrade) return null;
  
  // Simply sum up the weighted grades
  return totalWeightedGrade;
}

export function getTotalWeight(components: Component[]): number {
  return components.reduce((sum, c) => sum + (c.weight || 0), 0);
}

export function getGradeColor(grade: number | null): string {
  if (grade === null) return 'text-muted-foreground';
  if (grade >= 90) return 'text-grade-excellent';
  if (grade >= 80) return 'text-grade-good';
  if (grade >= 70) return 'text-grade-average';
  if (grade >= 60) return 'text-grade-passing';
  return 'text-grade-failing';
}

export function getGradeBg(grade: number | null): string {
  if (grade === null) return 'bg-muted';
  if (grade >= 90) return 'bg-grade-excellent/10';
  if (grade >= 80) return 'bg-grade-good/10';
  if (grade >= 70) return 'bg-grade-average/10';
  if (grade >= 60) return 'bg-grade-passing/10';
  return 'bg-grade-failing/10';
}

export function formatGrade(grade: number | null): string {
  if (grade === null) return '—';
  return grade.toFixed(1);
}

export function getLetterGrade(grade: number | null): string {
  if (grade === null) return '—';
  const clampedGrade = Math.min(100, Math.max(0, grade));
  if (clampedGrade >= 90) return 'A+';
  if (clampedGrade >= 85) return 'A';
  if (clampedGrade >= 80) return 'A-';
  if (clampedGrade >= 76) return 'B+';
  if (clampedGrade >= 72) return 'B';
  if (clampedGrade >= 68) return 'B-';
  if (clampedGrade >= 64) return 'C+';
  if (clampedGrade >= 60) return 'C';
  if (clampedGrade >= 55) return 'C-';
  if (clampedGrade >= 50) return 'D';
  return 'F';
}
