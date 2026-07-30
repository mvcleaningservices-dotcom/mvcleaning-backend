import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as bcrypt from 'bcryptjs';
import { Worker, WorkerDocument } from './schemas/worker.schema';
import { CreateWorkerDto, UpdateWorkerDto } from './dto/worker.dto';

@Injectable()
export class WorkersService {
  constructor(
    @InjectModel(Worker.name)
    private readonly workerModel: Model<WorkerDocument>,
  ) {}

  /** Reject a username already taken by a DIFFERENT worker. */
  private async assertUsernameFree(username: string, exceptId?: string) {
    const existing = await this.workerModel.findOne({
      username: username.toLowerCase(),
    });
    if (existing && existing.id !== exceptId) {
      throw new BadRequestException('That username is already in use');
    }
  }

  async create(dto: CreateWorkerDto) {
    const doc: Record<string, unknown> = {
      name: dto.name,
      contactNumber: dto.contactNumber,
      area: dto.area ?? '',
      services: dto.services ?? [],
    };
    // Optional Service Partner login — set only when both are provided.
    if (dto.username && dto.password) {
      await this.assertUsernameFree(dto.username);
      doc.username = dto.username.toLowerCase();
      doc.passwordHash = await bcrypt.hash(dto.password, 10);
    }
    return this.workerModel.create(doc);
  }

  /** Look up a partner by login username (for /auth/partner/login). */
  findByUsername(username: string) {
    return this.workerModel.findOne({ username: username.toLowerCase() }).exec();
  }

  verifyPassword(plain: string, hash: string): Promise<boolean> {
    return bcrypt.compare(plain, hash);
  }

  list(activeOnly = false) {
    const filter = activeOnly ? { isActive: true } : {};
    return this.workerModel.find(filter).sort({ name: 1 }).exec();
  }

  async findById(id: string): Promise<WorkerDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid worker id');
    }
    const worker = await this.workerModel.findById(id);
    if (!worker) throw new NotFoundException('Worker not found');
    return worker;
  }

  /** Only an active worker may be assigned to an order. */
  async getAssignable(id: string): Promise<WorkerDocument> {
    const worker = await this.findById(id);
    if (!worker.isActive) {
      throw new BadRequestException('Worker is disabled and cannot be assigned');
    }
    return worker;
  }

  async update(id: string, dto: UpdateWorkerDto): Promise<WorkerDocument> {
    const worker = await this.findById(id);
    if (dto.name !== undefined) worker.name = dto.name;
    if (dto.contactNumber !== undefined) worker.contactNumber = dto.contactNumber;
    if (dto.area !== undefined) worker.area = dto.area;
    if (dto.isActive !== undefined) worker.isActive = dto.isActive;
    if (dto.services !== undefined) worker.services = dto.services;
    // Optional Service Partner login: set/clear the username, (re)set password.
    if (dto.username !== undefined) {
      if (dto.username) {
        await this.assertUsernameFree(dto.username, worker.id);
        worker.username = dto.username.toLowerCase();
      } else {
        worker.username = undefined; // clearing the username removes login access
      }
    }
    if (dto.password) {
      worker.passwordHash = await bcrypt.hash(dto.password, 10);
    }
    await worker.save();
    return worker;
  }

  view(w: WorkerDocument) {
    return {
      id: w.id,
      name: w.name,
      contactNumber: w.contactNumber,
      area: w.area,
      isActive: w.isActive,
      services: w.services ?? [],
      // Never expose the hash — just whether a login exists, for the admin UI.
      username: w.username ?? '',
      hasLogin: !!w.username && !!w.passwordHash,
    };
  }
}
