import { Controller, Get } from '@nestjs/common';
import { NaborService, NaborGroup } from './nabor.service';

@Controller('api/nabor')
export class NaborController {
  constructor(private readonly naborService: NaborService) {}

  @Get()
  async getNaborGroups(): Promise<NaborGroup[]> {
    return this.naborService.getNaborGroups();
  }
}
