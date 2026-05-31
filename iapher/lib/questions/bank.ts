export type QuestionType = 'pick' | 'multi' | 'scale' | 'voice_text'
export type Lang = 'en' | 'kh' | 'ga' | 'pn'

export interface Question {
  id: string
  section: string
  type: QuestionType
  required?: boolean
  text: Record<Lang, string>
  options?: Record<Lang, string>[]
  scaleMin?: Record<Lang, string>
  scaleMax?: Record<Lang, string>
  scaleSteps?: number
}

export const QUESTIONS: Question[] = [
  {
    id: 'q_age',
    section: 'demo',
    type: 'pick',
    required: true,
    text: {
      en: 'How old are you?',
      kh: 'Katno u snem jong phi?',
      ga: 'Aro nimbireka?',
      pn: 'Katno u snem jong phi?'
    },
    options: [
      { en: '13–15', kh: '13–15', ga: '13–15', pn: '13–15' },
      { en: '16–18', kh: '16–18', ga: '16–18', pn: '16–18' },
      { en: '19–21', kh: '19–21', ga: '19–21', pn: '19–21' },
      { en: '22–24', kh: '22–24', ga: '22–24', pn: '22–24' },
      { en: '25–29', kh: '25–29', ga: '25–29', pn: '25–29' }
    ]
  },
  {
    id: 'q_gender',
    section: 'demo',
    type: 'pick',
    required: true,
    text: {
      en: 'How do you describe yourself?',
      kh: 'Phi la kynmaw ia phi katno?',
      ga: 'Aro nisa ong ia ngi?',
      pn: 'Phi la kynmaw ia phi katno?'
    },
    options: [
      { en: 'Female', kh: 'Kynthei', ga: 'Kynthei', pn: 'Kynthei' },
      { en: 'Male', kh: 'Shynrang', ga: 'Shynrang', pn: 'Shynrang' },
      { en: 'Non-binary / gender diverse', kh: 'Nongkynmaw khlem sah', ga: 'Gender diverse', pn: 'Nongkynmaw khlem sah' },
      { en: 'Prefer not to say', kh: 'Lym tip pat', ga: 'Lym tip pat', pn: 'Lym tip pat' }
    ]
  },
  {
    id: 'q_district',
    section: 'demo',
    type: 'pick',
    required: true,
    text: {
      en: 'Which district do you live in?',
      kh: 'Phi shong ha district dei?',
      ga: 'Baksa district ngi ong?',
      pn: 'Phi shong ha district dei?'
    },
    options: [
      { en: 'East Khasi Hills', kh: 'East Khasi Hills', ga: 'East Khasi Hills', pn: 'East Khasi Hills' },
      { en: 'West Khasi Hills', kh: 'West Khasi Hills', ga: 'West Khasi Hills', pn: 'West Khasi Hills' },
      { en: 'South West Khasi Hills', kh: 'South West Khasi Hills', ga: 'South West Khasi Hills', pn: 'South West Khasi Hills' },
      { en: 'Ri Bhoi', kh: 'Ri Bhoi', ga: 'Ri Bhoi', pn: 'Ri Bhoi' },
      { en: 'East Jaintia Hills', kh: 'East Jaintia Hills', ga: 'East Jaintia Hills', pn: 'East Jaintia Hills' },
      { en: 'West Jaintia Hills', kh: 'West Jaintia Hills', ga: 'West Jaintia Hills', pn: 'West Jaintia Hills' },
      { en: 'East Garo Hills', kh: 'East Garo Hills', ga: 'East Garo Hills', pn: 'East Garo Hills' },
      { en: 'West Garo Hills', kh: 'West Garo Hills', ga: 'West Garo Hills', pn: 'West Garo Hills' },
      { en: 'South Garo Hills', kh: 'South Garo Hills', ga: 'South Garo Hills', pn: 'South Garo Hills' },
      { en: 'North Garo Hills', kh: 'North Garo Hills', ga: 'North Garo Hills', pn: 'North Garo Hills' },
      { en: 'Eastern West Khasi Hills', kh: 'Eastern West Khasi Hills', ga: 'Eastern West Khasi Hills', pn: 'Eastern West Khasi Hills' }
    ]
  },
  {
    id: 'q_wellbeing_overall',
    section: 'wellbeing',
    type: 'scale',
    required: true,
    scaleSteps: 10,
    text: {
      en: 'Overall, how would you rate your wellbeing right now?',
      kh: 'Kumno phi tip ia jong phi ha jingiasuh mynta?',
      ga: 'Aro ngi ong kumno sa aro ngi ong jongngi mynta?',
      pn: 'Kumno phi tip ia jong phi ha jingiasuh mynta?'
    },
    scaleMin: { en: 'Very poor', kh: 'Kham bad', ga: 'Manchi bad', pn: 'Kham bad' },
    scaleMax: { en: 'Excellent', kh: 'Kham lah', ga: 'Bor good', pn: 'Kham lah' }
  },
  {
    id: 'q_wellbeing_domains',
    section: 'wellbeing',
    type: 'multi',
    text: {
      en: 'Which areas of your life feel most challenging right now? (Select all that apply)',
      kh: 'Dei dei thaw ha mynta phi la buh haduh?',
      ga: 'Baka area ngi ong jongngi sa manchi bor hard mynta?',
      pn: 'Dei dei thaw ha mynta phi la buh haduh?'
    },
    options: [
      { en: 'Mental health / emotions', kh: 'Jingthymme / jingiasem', ga: 'Mental health', pn: 'Jingthymme / jingiasem' },
      { en: 'Physical health', kh: 'Jingshong sha', ga: 'Physical health', pn: 'Jingshong sha' },
      { en: 'Relationships & family', kh: 'Jingim bad kur kha', ga: 'Relationships', pn: 'Jingim bad kur kha' },
      { en: 'Work or school', kh: 'Shong / Skul', ga: 'Skul/work', pn: 'Shong / Skul' },
      { en: 'Money / financial pressure', kh: 'Jingpait jingiap', ga: 'Financial', pn: 'Jingpait jingiap' },
      { en: 'Environment / climate', kh: 'Jingkynmaw tem', ga: 'Climate/environment', pn: 'Jingkynmaw tem' },
      { en: 'Sexual & reproductive health', kh: 'SRH', ga: 'SRH', pn: 'SRH' },
      { en: 'Nothing feels challenging', kh: 'Khlem noh', ga: 'Nonggin noh', pn: 'Khlem noh' }
    ]
  },
  {
    id: 'q_mental_freq',
    section: 'mental_health',
    type: 'pick',
    text: {
      en: 'Over the past month, how often have you felt sad, anxious, or hopeless?',
      kh: 'Ha u bnai ïa ioh, phi la tip jingiasem burom kumno?',
      ga: 'Ha u month ïa ioh, kumno bor phi la ong jingiasem sad?',
      pn: 'Ha u bnai ïa ioh, phi la tip jingiasem burom kumno?'
    },
    options: [
      { en: 'Never', kh: 'Khlem', ga: 'Nongkin', pn: 'Khlem' },
      { en: 'Rarely', kh: 'Bym biang', ga: 'Bym biang', pn: 'Bym biang' },
      { en: 'Sometimes', kh: 'Sah sah', ga: 'Sah sah', pn: 'Sah sah' },
      { en: 'Often', kh: 'Biang biang', ga: 'Biang biang', pn: 'Biang biang' },
      { en: 'Almost always', kh: 'Ïap ïap', ga: 'Ïap ïap', pn: 'Ïap ïap' }
    ]
  },
  {
    id: 'q_mental_support',
    section: 'mental_health',
    type: 'pick',
    text: {
      en: 'When you feel this way, who do you usually turn to for support?',
      kh: 'Lada phi tip jingiasem bad, neikin phi wan sha kano nongkynmaw?',
      ga: 'Lada ngi ong jingiasem kumta, neikin ngi ong sha kano?',
      pn: 'Lada phi tip jingiasem bad, neikin phi wan sha kano nongkynmaw?'
    },
    options: [
      { en: 'Family', kh: 'Kur kha', ga: 'Kur kha', pn: 'Kur kha' },
      { en: 'Friends', kh: 'Raplang', ga: 'Raplang', pn: 'Raplang' },
      { en: 'Religious leader / church', kh: 'Nongklam / sorkar', ga: 'Nongklam / church', pn: 'Nongklam / sorkar' },
      { en: 'Teacher / school counsellor', kh: 'Bah kynmaw / nongbang', ga: 'Nongbang', pn: 'Bah kynmaw / nongbang' },
      { en: 'Health worker / doctor', kh: 'Nong ïakhun / doctor', ga: 'Doctor', pn: 'Nong ïakhun / doctor' },
      { en: 'Online / social media', kh: 'Online / social media', ga: 'Online / social media', pn: 'Online / social media' },
      { en: 'Nobody / I handle it alone', kh: 'Khlam noh / nga ioh da nga mynsiem', ga: 'Nonggin / alone', pn: 'Khlam noh / nga ioh da nga mynsiem' }
    ]
  },
  {
    id: 'q_mental_open',
    section: 'mental_health',
    type: 'voice_text',
    text: {
      en: 'Is there anything about your mental health that you\'d like to share in your own words?',
      kh: 'Dei noh phi dang tip ban ïoh haba jingthymme jong phi?',
      ga: 'Dei noh ngi dang tip ban ïoh haba mental health jongngi?',
      pn: 'Dei noh phi dang tip ban ïoh haba jingthymme jong phi?'
    }
  },
  {
    id: 'q_work_status',
    section: 'work',
    type: 'pick',
    text: {
      en: 'What is your current work or study situation?',
      kh: 'Katno u jingshong / jingbang ha mynta?',
      ga: 'Baksa situation ngi ong shong/bang mynta?',
      pn: 'Katno u jingshong / jingbang ha mynta?'
    },
    options: [
      { en: 'In school / college', kh: 'Ha skul / college', ga: 'Ha skul / college', pn: 'Ha skul / college' },
      { en: 'Working full-time', kh: 'Shong pynkut', ga: 'Shong pynkut', pn: 'Shong pynkut' },
      { en: 'Working part-time', kh: 'Shong sah sah', ga: 'Shong sah sah', pn: 'Shong sah sah' },
      { en: 'Looking for work', kh: 'Pynhiar shong', ga: 'Pynhiar shong', pn: 'Pynhiar shong' },
      { en: 'Not working or studying', kh: 'Bym shong bym bang', ga: 'Bym shong bym bang', pn: 'Bym shong bym bang' }
    ]
  },
  {
    id: 'q_work_pressure',
    section: 'work',
    type: 'scale',
    scaleSteps: 5,
    text: {
      en: 'How much pressure do you feel from work or school expectations?',
      kh: 'Katno u jingburom phi tip ha shong / skul?',
      ga: 'Kumno bor jingburom ngi ong ha shong / skul?',
      pn: 'Katno u jingburom phi tip ha shong / skul?'
    },
    scaleMin: { en: 'No pressure', kh: 'Khlem jingburom', ga: 'Nongkin burom', pn: 'Khlem jingburom' },
    scaleMax: { en: 'Extreme pressure', kh: 'Jingburom kham biang', ga: 'Bor burom', pn: 'Jingburom kham biang' }
  },
  {
    id: 'q_relationships_safety',
    section: 'relationships',
    type: 'pick',
    text: {
      en: 'Do you feel safe and respected in your closest relationships?',
      kh: 'Phi tip jingïap bad jingkhlaw ha jingim jong phi?',
      ga: 'Ngi ong safe bad respected ha jingim jongngi?',
      pn: 'Phi tip jingïap bad jingkhlaw ha jingim jong phi?'
    },
    options: [
      { en: 'Yes, always', kh: 'Ïa, ïap ïap', ga: 'Ïa, ïap ïap', pn: 'Ïa, ïap ïap' },
      { en: 'Mostly yes', kh: 'Biang biang ïa', ga: 'Biang biang ïa', pn: 'Biang biang ïa' },
      { en: 'Sometimes', kh: 'Sah sah', ga: 'Sah sah', pn: 'Sah sah' },
      { en: 'Mostly no', kh: 'Biang biang khlam', ga: 'Biang biang khlam', pn: 'Biang biang khlam' },
      { en: 'No, I feel unsafe', kh: 'Khlam, nga tip jingshapbiang', ga: 'Khlam, nga ong unsafe', pn: 'Khlam, nga tip jingshapbiang' }
    ]
  },
  {
    id: 'q_srh_info',
    section: 'srh',
    type: 'pick',
    text: {
      en: 'Do you feel you have enough information about sexual and reproductive health?',
      kh: 'Phi tip ban neh haba SRH?',
      ga: 'Ngi ong ngi la ioh bor information ha SRH?',
      pn: 'Phi tip ban neh haba SRH?'
    },
    options: [
      { en: 'Yes, more than enough', kh: 'Ïa, biang neh', ga: 'Ïa, biang neh', pn: 'Ïa, biang neh' },
      { en: 'Enough', kh: 'Neh', ga: 'Neh', pn: 'Neh' },
      { en: 'Not enough', kh: 'Bym neh', ga: 'Bym neh', pn: 'Bym neh' },
      { en: 'Very little', kh: 'Sah sah ban neh', ga: 'Sah sah neh', pn: 'Sah sah ban neh' },
      { en: 'None at all', kh: 'Khlem noh', ga: 'Nongkin noh', pn: 'Khlem noh' }
    ]
  },
  {
    id: 'q_srh_barriers',
    section: 'srh',
    type: 'multi',
    text: {
      en: 'What makes it difficult to access SRH services? (Select all that apply)',
      kh: 'Dei dei thaw bym ïoh lah ban wan sha SRH services?',
      ga: 'Baksa thaw bym ïoh SRH services?',
      pn: 'Dei dei thaw bym ïoh lah ban wan sha SRH services?'
    },
    options: [
      { en: 'Shame or stigma', kh: 'Jingïohleh / jingïakren', ga: 'Shame / stigma', pn: 'Jingïohleh / jingïakren' },
      { en: 'Lack of privacy', kh: 'Bym ïoh jingphah mynsiem', ga: 'Bym ïoh privacy', pn: 'Bym ïoh jingphah mynsiem' },
      { en: 'Cost', kh: 'Jingpait', ga: 'Cost', pn: 'Jingpait' },
      { en: 'Distance to services', kh: 'Jingdur sha services', ga: 'Distance', pn: 'Jingdur sha services' },
      { en: 'Don\'t know where to go', kh: 'Bym tip sha dei ban ia', ga: 'Bym tip sha dei', pn: 'Bym tip sha dei ban ia' },
      { en: 'Family or community disapproval', kh: 'Kur kha / seng bym ïoh lah', ga: 'Family disapproval', pn: 'Kur kha / seng bym ïoh lah' },
      { en: 'Services don\'t feel safe or trustworthy', kh: 'Services bym ïap', ga: 'Services bym safe', pn: 'Services bym ïap' },
      { en: 'No barriers', kh: 'Khlem noh', ga: 'Nongkin', pn: 'Khlem noh' }
    ]
  },
  {
    id: 'q_physical_activity',
    section: 'physical',
    type: 'pick',
    text: {
      en: 'How often do you engage in physical activity (sports, walking, etc.)?',
      kh: 'Katno phi ïoh jingshym sha jingkynmaw sha sha (ka kot, ka ia, etc.)?',
      ga: 'Kumno bor ngi ong physical activity?',
      pn: 'Katno phi ïoh jingshym sha jingkynmaw sha sha (ka kot, ka ia, etc.)?'
    },
    options: [
      { en: 'Every day', kh: 'Ïap sngi', ga: 'Ïap sngi', pn: 'Ïap sngi' },
      { en: '3–5 times a week', kh: '3–5 snem ha u synshar', ga: '3–5 times a week', pn: '3–5 snem ha u synshar' },
      { en: '1–2 times a week', kh: '1–2 snem ha u synshar', ga: '1–2 times a week', pn: '1–2 snem ha u synshar' },
      { en: 'Rarely', kh: 'Bym biang', ga: 'Bym biang', pn: 'Bym biang' },
      { en: 'Never', kh: 'Khlem', ga: 'Nongkin', pn: 'Khlem' }
    ]
  },
  {
    id: 'q_physical_sleep',
    section: 'physical',
    type: 'pick',
    text: {
      en: 'How many hours of sleep do you usually get per night?',
      kh: 'Katno u sumar phi la iap ha u bnong?',
      ga: 'Kumno bor sumar ngi ong iap ha u bnong?',
      pn: 'Katno u sumar phi la iap ha u bnong?'
    },
    options: [
      { en: 'Less than 5 hours', kh: 'Bym neh 5 sumar', ga: 'Less than 5 hours', pn: 'Bym neh 5 sumar' },
      { en: '5–6 hours', kh: '5–6 sumar', ga: '5–6 hours', pn: '5–6 sumar' },
      { en: '7–8 hours', kh: '7–8 sumar', ga: '7–8 hours', pn: '7–8 sumar' },
      { en: 'More than 8 hours', kh: 'Biang 8 sumar', ga: 'More than 8 hours', pn: 'Biang 8 sumar' }
    ]
  },
  {
    id: 'q_climate_impact',
    section: 'climate',
    type: 'pick',
    text: {
      en: 'Have you personally experienced impacts from climate change or environmental issues?',
      kh: 'Phi la ioh da phi mynsiem haba jingkynmaw tem / u bnong?',
      ga: 'Ngi la ioh da climate change?',
      pn: 'Phi la ioh da phi mynsiem haba jingkynmaw tem / u bnong?'
    },
    options: [
      { en: 'Yes, significantly', kh: 'Ïa, biang', ga: 'Ïa, biang', pn: 'Ïa, biang' },
      { en: 'Yes, somewhat', kh: 'Ïa, sah sah', ga: 'Ïa, sah sah', pn: 'Ïa, sah sah' },
      { en: 'Not sure', kh: 'Bym tip', ga: 'Bym tip', pn: 'Bym tip' },
      { en: 'No', kh: 'Khlam', ga: 'Khlam', pn: 'Khlam' }
    ]
  },
  {
    id: 'q_climate_worry',
    section: 'climate',
    type: 'scale',
    scaleSteps: 5,
    text: {
      en: 'How worried are you about the future because of environmental problems?',
      kh: 'Katno phi burom haba jingpyrshah ha jingkynmaw tem?',
      ga: 'Kumno bor ngi ong burom haba jingpyrshah?',
      pn: 'Katno phi burom haba jingpyrshah ha jingkynmaw tem?'
    },
    scaleMin: { en: 'Not worried', kh: 'Khlem burom', ga: 'Nongkin burom', pn: 'Khlem burom' },
    scaleMax: { en: 'Extremely worried', kh: 'Kham burom', ga: 'Bor burom', pn: 'Kham burom' }
  },
  {
    id: 'q_cmyc_aware',
    section: 'cmyc',
    type: 'pick',
    text: {
      en: 'Have you heard of or visited a CMYC (Community Mental Wellness Centre)?',
      kh: 'Phi la ioh klang ia CMYC bad phi la wan sha?',
      ga: 'Ngi la ioh klang ia CMYC?',
      pn: 'Phi la ioh klang ia CMYC bad phi la wan sha?'
    },
    options: [
      { en: 'Yes, I have visited', kh: 'Ïa, nga la wan sha', ga: 'Ïa, nga la wan sha', pn: 'Ïa, nga la wan sha' },
      { en: 'I have heard of it but not visited', kh: 'Nga la ioh klang khlam wan sha', ga: 'La ioh klang, bym wan sha', pn: 'Nga la ioh klang khlam wan sha' },
      { en: 'No, first time hearing', kh: 'Khlam, mynta ïa ioh klang', ga: 'Khlam, mynta ïa ioh klang', pn: 'Khlam, mynta ïa ioh klang' }
    ]
  },
  {
    id: 'q_cmyc_use',
    section: 'cmyc',
    type: 'multi',
    text: {
      en: 'If you have visited a CMYC, what did you use it for? (Select all that apply)',
      kh: 'Lada phi la wan sha CMYC, dei dei ha phi la shim ia noh?',
      ga: 'Lada ngi la wan sha CMYC, baksa ngi la shim ia?',
      pn: 'Lada phi la wan sha CMYC, dei dei ha phi la shim ia noh?'
    },
    options: [
      { en: 'Counselling', kh: 'Jingbang nongkynmaw', ga: 'Counselling', pn: 'Jingbang nongkynmaw' },
      { en: 'Health check-up', kh: 'Jingïakren jingshong', ga: 'Health check', pn: 'Jingïakren jingshong' },
      { en: 'Youth activities / skills', kh: 'Jingim iing / skills', ga: 'Youth activities', pn: 'Jingim iing / skills' },
      { en: 'Information / awareness', kh: 'Information / jingïakren', ga: 'Information', pn: 'Information / jingïakren' },
      { en: 'Referral / support', kh: 'Jingpynkuli / jingiasist', ga: 'Referral', pn: 'Jingpynkuli / jingiasist' },
      { en: 'I haven\'t visited', kh: 'Bym wan sha', ga: 'Bym wan sha', pn: 'Bym wan sha' }
    ]
  },
  {
    id: 'q_cmyc_needed',
    section: 'cmyc',
    type: 'multi',
    text: {
      en: 'What services do you most need from a youth wellness centre? (Select up to 3)',
      kh: 'Dei dei services phi dang neh biang ha youth wellness centre? (Buh haduh 3)',
      ga: 'Baksa services ngi dang neh biang ha youth wellness centre?',
      pn: 'Dei dei services phi dang neh biang ha youth wellness centre? (Buh haduh 3)'
    },
    options: [
      { en: 'Mental health support', kh: 'Jingïasist jingthymme', ga: 'Mental health support', pn: 'Jingïasist jingthymme' },
      { en: 'Sexual & reproductive health', kh: 'SRH', ga: 'SRH', pn: 'SRH' },
      { en: 'Employment / skills training', kh: 'Shong / skills', ga: 'Skills training', pn: 'Shong / skills' },
      { en: 'Sports & recreation', kh: 'Jingkot / jingshym', ga: 'Sports', pn: 'Jingkot / jingshym' },
      { en: 'Safe space to talk', kh: 'Jingphah mynsiem ban ia', ga: 'Safe space', pn: 'Jingphah mynsiem ban ia' },
      { en: 'Nutrition & physical health', kh: 'Nutrition / jingshong sha', ga: 'Nutrition', pn: 'Nutrition / jingshong sha' },
      { en: 'Digital / technology skills', kh: 'Digital skills', ga: 'Digital skills', pn: 'Digital skills' },
      { en: 'Legal aid / rights information', kh: 'Legal aid / jingpynkuli', ga: 'Legal aid', pn: 'Legal aid / jingpynkuli' }
    ]
  },
  {
    id: 'q_open_final',
    section: 'cmyc',
    type: 'voice_text',
    text: {
      en: 'Is there anything else you\'d like to share — something that matters to you that we haven\'t asked about?',
      kh: 'Dei noh dang ïoh ban ia — dei noh phi dang tip ban ïoh haka phi bym la phi ia?',
      ga: 'Dei noh ngi dang ïoh ban ia — dei noh ngi dang tip ban ïoh haka ngi bym la ia?',
      pn: 'Dei noh dang ïoh ban ia — dei noh phi dang tip ban ïoh haka phi bym la phi ia?'
    }
  }
]

export const SECTION_ORDER = ['demo', 'wellbeing', 'mental_health', 'work', 'relationships', 'srh', 'physical', 'climate', 'cmyc']

export const SECTION_LABELS: Record<string, Record<Lang, string>> = {
  demo: { en: 'About You', kh: 'Haba Phi', ga: 'Haba Ngi', pn: 'Haba Phi' },
  wellbeing: { en: 'Wellbeing', kh: 'Jingïasuh', ga: 'Wellbeing', pn: 'Jingïasuh' },
  mental_health: { en: 'Mental Health', kh: 'Jingthymme', ga: 'Mental Health', pn: 'Jingthymme' },
  work: { en: 'Work & Study', kh: 'Shong & Bang', ga: 'Shong & Bang', pn: 'Shong & Bang' },
  relationships: { en: 'Relationships', kh: 'Jingim', ga: 'Jingim', pn: 'Jingim' },
  srh: { en: 'Sexual & Reproductive Health', kh: 'SRH', ga: 'SRH', pn: 'SRH' },
  physical: { en: 'Physical Health', kh: 'Jingshong Sha', ga: 'Physical Health', pn: 'Jingshong Sha' },
  climate: { en: 'Environment & Climate', kh: 'Jingkynmaw Tem', ga: 'Climate', pn: 'Jingkynmaw Tem' },
  cmyc: { en: 'Youth Wellness Centre', kh: 'CMYC', ga: 'CMYC', pn: 'CMYC' }
}
