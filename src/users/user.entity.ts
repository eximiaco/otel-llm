import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import { Transaction } from '../transactions/transaction.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  userId: string;

  @Column()
  email: string;

  @OneToMany(() => Transaction, (transaction) => transaction.user)
  transactions: Transaction[];
}
