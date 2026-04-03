import { AppDataSource } from './data-source';
import { TokenSeeder } from '../tokens/services/token-seeder.service';
import { Token } from '../tokens/entities/token.entity';
import { Chain } from '../tokens/entities/chain.entity';
import { Logo } from '../tokens/entities/logo.entity';

async function seed() {
  try {
    // Initialize the data source
    await AppDataSource.initialize();
    console.log('Data source has been initialized');

    // Create repositories
    const tokenRepository = AppDataSource.getRepository(Token);
    const chainRepository = AppDataSource.getRepository(Chain);
    const logoRepository = AppDataSource.getRepository(Logo);

    // Create token seeder
    const tokenSeeder = new TokenSeeder(
      tokenRepository,
      chainRepository,
      logoRepository,
    );

    // Seed data
    await tokenSeeder.seed();
    console.log('Database seeded successfully');

    // Close the connection
    await AppDataSource.destroy();
    console.log('Data source has been closed');
  } catch (error) {
    console.error('Error during seeding process:', error);
    process.exit(1);
  }
}

// Run the seeder
seed()
  .then(() => {
    console.log('Seeding completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Failed to seed database:', error);
    process.exit(1);
  });
