import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { OrderStatus } from '../../../common/enums/order-status.enum';

export class AssignWorkerDto {
  @IsString()
  workerId: string;
}

export class ReassignWorkerDto {
  @IsString()
  workerId: string;

  @IsString()
  @MinLength(3, { message: 'A reassignment reason is required' })
  @MaxLength(300)
  reason: string;
}

export class UpdateStatusDto {
  @IsIn([
    OrderStatus.ASSIGNED,
    OrderStatus.IN_PROGRESS,
    OrderStatus.COMPLETED,
    OrderStatus.CANCELLED,
  ])
  status: OrderStatus;
}

export class AddNoteDto {
  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  text: string;
}

export class AddProofDto {
  @IsString()
  imageData: string;
}

export class CancelOrderDto {
  @IsOptional()
  @IsString()
  @MaxLength(300)
  reason?: string;
}
