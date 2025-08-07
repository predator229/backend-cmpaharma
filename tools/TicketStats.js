class TicketStats {
  constructor(data = {}) {
    this.total = data.total || 0;
    this.open = data.open || 0;
    this.inProgress = data.inProgress || 0;
    this.resolved = data.resolved || 0;
    this.closed = data.closed || 0;
    this.pending = data.pending || 0;

    this.byPriority = {
      low: data.byPriority?.low || 0,
      medium: data.byPriority?.medium || 0,
      high: data.byPriority?.high || 0,
      urgent: data.byPriority?.urgent || 0
    };

    this.byCategory = {
      technical: data.byCategory?.technical || 0,
      billing: data.byCategory?.billing || 0,
      account: data.byCategory?.account || 0,
      feature_request: data.byCategory?.feature_request || 0,
      bug_report: data.byCategory?.bug_report || 0,
      general: data.byCategory?.general || 0
    };

    this.averageResolutionTime = data.averageResolutionTime || 0;
    this.totalUnread = data.totalUnread || 0;
  }
}

module.exports = TicketStats;
