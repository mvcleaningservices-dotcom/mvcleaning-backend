import { IsInt, Min } from 'class-validator';

export class UpdateAdvanceAmountDto {
  /** May be 0 to make the advance optional (scope §3.2.5). */
  @IsInt()
  @Min(0)
  amount: number;
}
