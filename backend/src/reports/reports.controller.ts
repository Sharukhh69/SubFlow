import {
  Controller,
  Get,
  Query,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { ReportsService } from './reports.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { DashboardSummaryDto } from './dto/dashboard-summary.dto';
import { MrrReportDto } from './dto/mrr-report.dto';
import { AgingReportDto } from './dto/aging-report.dto';
import { RevenueTrendDto } from './dto/revenue-trend.dto';
import { ReportQueryDto } from './dto/report-query.dto';

@ApiTags('reports')
@Controller('reports')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('summary')
  @Roles(Role.ADMIN, Role.STAFF)
  @ApiOperation({
    summary: 'Executive Dashboard Summary KPI Cards',
    description: 'Returns active subscriptions, normalized MRR, ARR, cash collected, and accounts receivable aging summary with 60-second in-memory caching.',
  })
  @ApiResponse({ status: 200, description: 'Dashboard metrics returned successfully', type: DashboardSummaryDto })
  @ApiResponse({ status: 403, description: 'Forbidden - Restricted to ADMIN and STAFF' })
  async getSummary(@Query() query: ReportQueryDto): Promise<DashboardSummaryDto> {
    return this.reportsService.getExecutiveSummary(query);
  }

  @Get('mrr')
  @Roles(Role.ADMIN, Role.STAFF)
  @ApiOperation({
    summary: 'MRR & ARR Analytics Breakdown',
    description: 'Returns segmented Monthly & Annual Recurring Revenue deconstructed by plan and billing frequency.',
  })
  @ApiResponse({ status: 200, description: 'MRR analytics report', type: MrrReportDto })
  @ApiResponse({ status: 403, description: 'Forbidden - Restricted to ADMIN and STAFF' })
  async getMrr(): Promise<MrrReportDto> {
    return this.reportsService.getMrrBreakdown();
  }

  @Get('aging')
  @Roles(Role.ADMIN, Role.STAFF)
  @ApiOperation({
    summary: 'Accounts Receivable Aging Analysis',
    description: 'Returns delinquent confirmed invoices grouped into standard 0-30, 31-60, 61-90, and 90+ days aging buckets.',
  })
  @ApiResponse({ status: 200, description: 'Aging report breakdown', type: AgingReportDto })
  @ApiResponse({ status: 403, description: 'Forbidden - Restricted to ADMIN and STAFF' })
  async getAging(): Promise<AgingReportDto> {
    return this.reportsService.getAgingReport();
  }

  @Get('revenue-trend')
  @Roles(Role.ADMIN, Role.STAFF)
  @ApiOperation({
    summary: 'Historical Monthly Revenue Trend',
    description: 'Returns chronological monthly trends for cash collections and invoiced amounts.',
  })
  @ApiQuery({ name: 'months', required: false, type: Number, description: 'Number of historical months (default: 6, max: 24)' })
  @ApiResponse({ status: 200, description: 'Revenue trend data', type: RevenueTrendDto })
  @ApiResponse({ status: 403, description: 'Forbidden - Restricted to ADMIN and STAFF' })
  async getRevenueTrend(@Query('months') months?: string): Promise<RevenueTrendDto> {
    const monthsCount = months ? parseInt(months, 10) : 6;
    return this.reportsService.getRevenueTrend(isNaN(monthsCount) ? 6 : monthsCount);
  }
}

