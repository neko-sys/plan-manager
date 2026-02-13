import type { AppView, Locale, ProjectStatus, TaskPriority, TaskStatus, TimerPhase } from "./models";

type I18nPack = {
  appTitle: string;
  appSubtitle: string;
  views: Record<AppView, string>;
  kpi: {
    projects: string;
    tasks: string;
    completionRate: string;
    remainingDays: string;
  };
  section: {
    dashboard: string;
    gantt: string;
    projectManager: string;
    taskManager: string;
    noteManager: string;
    upcoming: string;
    settings: string;
    cache: string;
  };
  field: {
    name: string;
    description: string;
    startDate: string;
    endDate: string;
    project: string;
    taskTitle: string;
    status: string;
    priority: string;
    dueDate: string;
    estimate: string;
    spent: string;
    noteTitle: string;
    noteContent: string;
    email: string;
  };
  action: {
    addProject: string;
    addTask: string;
    addNote: string;
    updateStatus: string;
    clearCache: string;
  };
  settings: {
    language: string;
    notifications: string;
    theme: string;
    account: string;
    privacy: string;
    telemetry: string;
    cacheRetention: string;
    cacheLastCleaned: string;
    light: string;
    dark: string;
    system: string;
  };
  status: Record<ProjectStatus | TaskStatus, string>;
  priority: Record<TaskPriority, string>;
  units: {
    days: string;
    hours: string;
  };
  pomodoro: {
    title: string;
    subtitle: string;
    phases: Record<TimerPhase, string>;
    actions: {
      start: string;
      pause: string;
      resume: string;
      reset: string;
      skip: string;
    };
    settings: {
      title: string;
      workDuration: string;
      shortBreakDuration: string;
      longBreakDuration: string;
      sessionsBeforeLongBreak: string;
      autoStartBreaks: string;
      autoStartWork: string;
      soundEnabled: string;
      notificationEnabled: string;
      vibrationEnabled: string;
      volume: string;
    };
    stats: {
      title: string;
      today: string;
      week: string;
      month: string;
      completed: string;
      focusTime: string;
      breakTime: string;
      pomodoros: string;
      minutes: string;
    };
    task: {
      selectTask: string;
      noTask: string;
      linkedTo: string;
    };
    export: {
      title: string;
      json: string;
      csv: string;
    };
  };
};

export const packs: Record<Locale, I18nPack> = {
  "zh-CN": {
    appTitle: "个人计划中台",
    appSubtitle: "项目、任务、进度与笔记的一体化工作区",
    views: {
      dashboard: "总览",
      projects: "项目",
      tasks: "任务",
      notes: "笔记",
      settings: "设置",
      pomodoro: "番茄钟",
    },
    kpi: {
      projects: "项目数",
      tasks: "任务数",
      completionRate: "任务完成率",
      remainingDays: "剩余工期",
    },
    section: {
      dashboard: "执行总览",
      gantt: "甘特时间线",
      projectManager: "项目管理",
      taskManager: "任务管理",
      noteManager: "笔记中心",
      upcoming: "近期任务",
      settings: "系统设置",
      cache: "缓存管理",
    },
    field: {
      name: "名称",
      description: "描述",
      startDate: "开始日期",
      endDate: "结束日期",
      project: "所属项目",
      taskTitle: "任务标题",
      status: "状态",
      priority: "优先级",
      dueDate: "截止日期",
      estimate: "预估工时",
      spent: "已耗工时",
      noteTitle: "笔记标题",
      noteContent: "笔记内容",
      email: "邮箱",
    },
    action: {
      addProject: "新建项目",
      addTask: "创建任务",
      addNote: "保存笔记",
      updateStatus: "更新状态",
      clearCache: "清理缓存",
    },
    settings: {
      language: "语言设置",
      notifications: "通知设置",
      theme: "主题切换",
      account: "账号管理",
      privacy: "隐私控制",
      telemetry: "使用数据采集",
      cacheRetention: "缓存保留天数",
      cacheLastCleaned: "最近缓存清理时间",
      light: "浅色",
      dark: "深色",
      system: "跟随系统",
    },
    status: {
      planning: "规划中",
      active: "进行中",
      completed: "已完成",
      todo: "待办",
      doing: "进行中",
      done: "已完成",
    },
    priority: {
      low: "低",
      medium: "中",
      high: "高",
    },
    units: {
      days: "天",
      hours: "小时",
    },
    pomodoro: {
      title: "番茄钟",
      subtitle: "专注工作，高效休息",
      phases: {
        work: "专注",
        shortBreak: "短休息",
        longBreak: "长休息",
      },
      actions: {
        start: "开始",
        pause: "暂停",
        resume: "继续",
        reset: "重置",
        skip: "跳过",
      },
      settings: {
        title: "番茄钟设置",
        workDuration: "工作时长",
        shortBreakDuration: "短休息时长",
        longBreakDuration: "长休息时长",
        sessionsBeforeLongBreak: "长休息间隔",
        autoStartBreaks: "自动开始休息",
        autoStartWork: "自动开始工作",
        soundEnabled: "声音提醒",
        notificationEnabled: "桌面通知",
        vibrationEnabled: "震动提醒",
        volume: "音量",
      },
      stats: {
        title: "统计数据",
        today: "今日",
        week: "本周",
        month: "本月",
        completed: "已完成",
        focusTime: "专注时长",
        breakTime: "休息时长",
        pomodoros: "个番茄",
        minutes: "分钟",
      },
      task: {
        selectTask: "选择任务",
        noTask: "未关联任务",
        linkedTo: "关联任务",
      },
      export: {
        title: "导出数据",
        json: "导出 JSON",
        csv: "导出 CSV",
      },
    },
  },
  "en-US": {
    appTitle: "Personal Planning Hub",
    appSubtitle: "Projects, tasks, tracking, and notes in one workspace",
    views: {
      dashboard: "Dashboard",
      projects: "Projects",
      tasks: "Tasks",
      notes: "Notes",
      settings: "Settings",
      pomodoro: "Pomodoro",
    },
    kpi: {
      projects: "Projects",
      tasks: "Tasks",
      completionRate: "Task Completion",
      remainingDays: "Remaining Window",
    },
    section: {
      dashboard: "Execution Overview",
      gantt: "Gantt Timeline",
      projectManager: "Project Manager",
      taskManager: "Task Manager",
      noteManager: "Notes",
      upcoming: "Upcoming Tasks",
      settings: "Settings",
      cache: "Cache Management",
    },
    field: {
      name: "Name",
      description: "Description",
      startDate: "Start Date",
      endDate: "End Date",
      project: "Project",
      taskTitle: "Task Title",
      status: "Status",
      priority: "Priority",
      dueDate: "Due Date",
      estimate: "Estimate",
      spent: "Spent",
      noteTitle: "Note Title",
      noteContent: "Note Content",
      email: "Email",
    },
    action: {
      addProject: "Create Project",
      addTask: "Create Task",
      addNote: "Save Note",
      updateStatus: "Update Status",
      clearCache: "Clear Cache",
    },
    settings: {
      language: "Language",
      notifications: "Notifications",
      theme: "Theme",
      account: "Account",
      privacy: "Privacy Control",
      telemetry: "Usage Telemetry",
      cacheRetention: "Cache Retention (days)",
      cacheLastCleaned: "Last cache cleanup",
      light: "Light",
      dark: "Dark",
      system: "System",
    },
    status: {
      planning: "Planning",
      active: "Active",
      completed: "Completed",
      todo: "Todo",
      doing: "In Progress",
      done: "Done",
    },
    priority: {
      low: "Low",
      medium: "Medium",
      high: "High",
    },
    units: {
      days: "days",
      hours: "hours",
    },
    pomodoro: {
      title: "Pomodoro",
      subtitle: "Focus work, effective rest",
      phases: {
        work: "Focus",
        shortBreak: "Short Break",
        longBreak: "Long Break",
      },
      actions: {
        start: "Start",
        pause: "Pause",
        resume: "Resume",
        reset: "Reset",
        skip: "Skip",
      },
      settings: {
        title: "Pomodoro Settings",
        workDuration: "Work Duration",
        shortBreakDuration: "Short Break Duration",
        longBreakDuration: "Long Break Duration",
        sessionsBeforeLongBreak: "Sessions Before Long Break",
        autoStartBreaks: "Auto Start Breaks",
        autoStartWork: "Auto Start Work",
        soundEnabled: "Sound Alert",
        notificationEnabled: "Desktop Notification",
        vibrationEnabled: "Vibration Alert",
        volume: "Volume",
      },
      stats: {
        title: "Statistics",
        today: "Today",
        week: "This Week",
        month: "This Month",
        completed: "Completed",
        focusTime: "Focus Time",
        breakTime: "Break Time",
        pomodoros: "pomodoros",
        minutes: "minutes",
      },
      task: {
        selectTask: "Select Task",
        noTask: "No task linked",
        linkedTo: "Linked to",
      },
      export: {
        title: "Export Data",
        json: "Export JSON",
        csv: "Export CSV",
      },
    },
  },
};
