import { Controller, Get, Res } from '@nestjs/common';
import { SentinelService } from './sentinel.service';
import { type Response } from 'express';

@Controller('sentinel')
export class SentinelController {
  constructor(private readonly sentinelService: SentinelService) {}
}
