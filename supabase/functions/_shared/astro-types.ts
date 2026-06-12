export interface VedicKootaDetail {
  description: string;
  male_koot_attribute: string;
  female_koot_attribute: string;
  total_points: number;
  received_points: number;
  male_point: number;
  female_point: number;
}

export interface VedicMatchReport {
  ashtakoota: {
    varna: VedicKootaDetail;
    vashya: VedicKootaDetail;
    tara: VedicKootaDetail;
    yoni: VedicKootaDetail;
    maitri: VedicKootaDetail;
    gan: VedicKootaDetail;
    bhakut: VedicKootaDetail;
    nadi: VedicKootaDetail;
    total: {
      total_points: number;
      received_points: number;
      minimum_required: number;
    };
    conclusion: {
      status: boolean;
      report: string;
    };
  };
  manglik: {
    status: boolean;
    male_percentage: number;
    female_percentage: number;
  };
  rajju_dosha: { status: boolean };
  vedha_dosha:  { status: boolean };
  conclusion: {
    match_report: string;
  };
}