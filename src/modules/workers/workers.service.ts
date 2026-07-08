import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Worker, WorkerDocument } from './schemas/worker.schema';
import { CreateWorkerDto, UpdateWorkerDto } from './dto/worker.dto';

@Injectable()
export class WorkersService {
  constructor(
    @InjectModel(Worker.name)
    private readonly workerModel: Model<WorkerDocument>,
  ) {}

  create(dto: CreateWorkerDto) {
    return this.workerModel.create({
      name: dto.name,
      contactNumber: dto.contactNumber,
      area: dto.area ?? '',
    });
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
    };
  }
}
