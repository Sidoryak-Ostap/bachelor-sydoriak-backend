import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { FieldsModule } from './fields/fields.module';
import { FieldActivityModule } from './field-activity/field-activity.module';
import { CloudinaryModule } from './cloudinary/cloudinary.module';
import { StatisticsModule } from './statistics/statistics.module';
import { SubscriptionModule } from './subscription/subscription.module';
import { WeatherModule } from './weather/weather.module';
import { ScheduleModule } from '@nestjs/schedule';
import { SentinelModule } from './sentinel/sentinel.module';
import { AiAnalysisReportModule } from './ai-analysis-report/ai-analysis-report.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        uri: config.get<string>('MONGODB_URI'),
      }),
    }),
    UsersModule,
    FieldsModule,
    FieldActivityModule,
    AuthModule,
    CloudinaryModule,
    StatisticsModule,
    SubscriptionModule,
    WeatherModule,
    ScheduleModule.forRoot(),
    SentinelModule,
    AiAnalysisReportModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
