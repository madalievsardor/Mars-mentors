import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { TutorsService } from './tutors.service';
import {
  BranchesResponse,
  CreateTutorAccountResult,
  TutorBookingStats,
  TutorCandidatesResponse,
  TutorsResponse,
  TutorSlotsResponse,
  TutorWriteResult,
} from './tutors.types';
import { UpdateTutorSlotsDto } from './dto/update-tutor-slots.dto';
import { UpdateTutorDto } from './dto/update-tutor.dto';
import { AddTutorDto } from './dto/add-tutor.dto';
import { CreateTutorAccountDto } from './dto/create-tutor-account.dto';

@Controller('api/tutors')
export class TutorsController {
  constructor(private readonly tutorsService: TutorsService) {}

  /** All tutors with their branch (for the schedule page list + filter). */
  @Get()
  async getTutors(): Promise<TutorsResponse> {
    return this.tutorsService.getTutors();
  }

  /** Users who can be promoted to tutor (active mentors, not yet tutors). */
  @Get('candidates')
  async getCandidates(): Promise<TutorCandidatesResponse> {
    return this.tutorsService.getCandidates();
  }

  /** Branches (filials) for the new-tutor form's branch dropdown. */
  @Get('branches')
  async getBranches(): Promise<BranchesResponse> {
    return this.tutorsService.getBranches();
  }

  /** Promote a user to the tutor role (JWT-protected). */
  @Post('add')
  async addTutor(@Body() dto: AddTutorDto): Promise<TutorWriteResult> {
    return this.tutorsService.addTutor(dto.userId);
  }

  /**
   * Create a brand-new Mars account for a new hire and promote it to tutor
   * (JWT-protected). Returns the new user id so the client can immediately open
   * the work-schedule editor.
   */
  @Post('create-account')
  async createTutorAccount(
    @Body() dto: CreateTutorAccountDto,
  ): Promise<CreateTutorAccountResult> {
    return this.tutorsService.createTutorAccount(dto);
  }

  /** Force a refresh of the tutor + slots caches. */
  @Post('refresh')
  async refresh(): Promise<TutorsResponse> {
    this.tutorsService.invalidateCache();
    return this.tutorsService.getTutors();
  }

  /** Today's booking count per tutor — single Mars API sweep, all tutors at once. */
  @Get('bookings-summary')
  async getBookingsSummary(): Promise<Record<number, number>> {
    return this.tutorsService.getTodayBookingsSummary();
  }

  /** Booking count + recent bookings for one tutor (from Mars API). */
  @Get(':id/bookings')
  async getTutorBookings(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<TutorBookingStats> {
    return this.tutorsService.getTutorBookingStats(id);
  }

  /** Weekly work schedule (booked slots per weekday) for one tutor. */
  @Get(':id/slots')
  async getTutorSlots(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<TutorSlotsResponse> {
    return this.tutorsService.getTutorSlots(id);
  }

  /**
   * Replace one weekday's working interval for a tutor (JWT-protected; the
   * global guard rejects unauthenticated callers).
   */
  @Post(':id/slots')
  async updateTutorSlots(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateTutorSlotsDto,
  ): Promise<TutorWriteResult> {
    return this.tutorsService.updateTutorSlots(
      id,
      dto.day,
      dto.fromHour,
      dto.tillHour,
    );
  }

  /** Edit a tutor's profile — name and/or branch (filial) (JWT-protected). */
  @Patch(':id')
  async updateTutor(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateTutorDto,
  ): Promise<TutorWriteResult> {
    return this.tutorsService.updateTutorProfile(id, {
      firstName: dto.firstName,
      lastName: dto.lastName,
      branchId: dto.branchId,
    });
  }

  /** Remove the tutor role -> back to plain mentor (JWT-protected). */
  @Post(':id/remove')
  async removeTutor(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<TutorWriteResult> {
    return this.tutorsService.removeTutor(id);
  }

  /**
   * ⚠️ PERMANENTLY delete the user from Mars (JWT-protected). Irreversible —
   * removes the Mars account entirely, not just the tutor role.
   */
  @Delete(':id')
  async deleteTutor(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<TutorWriteResult> {
    return this.tutorsService.deleteTutor(id);
  }
}
