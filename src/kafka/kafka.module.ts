import { Module } from '@nestjs/common';
import { KafkaProducerService } from './kafka-producer.service';

@Module({
  providers: [KafkaProducerService],
  exports: [KafkaProducerService], // Export for use in other modules
})
export class KafkaModule {}

