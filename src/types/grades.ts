export interface SubComponent {
  id: string;
  componentId: string;
  name: string;
  grade: number | null;
}

export interface Component {
  id: string;
  courseId: string;
  name: string;
  weight: number;
  dropLowestCount: number | null;
  downweightLowestCount: number | null;
  downweightPercent: number | null;
  subComponents: SubComponent[];
}

export interface Course {
  id: string;
  name: string;
  components: Component[];
}

export type AdvancedOption = 'none' | 'dropLowest' | 'downweight';
