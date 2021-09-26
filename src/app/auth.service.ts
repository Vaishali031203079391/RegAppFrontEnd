import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { AuthData } from './auth-data.model';
import { Subject } from 'rxjs';
import { Router, ActivatedRoute } from '@angular/router';
import 'rxjs/add/operator/map';
import { map } from 'rxjs/operators';
import { environment } from '../environments/environment';

const BACKEND_URL = environment.apiURL;

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private isAuthenticated = false;
  token: string = '';
  public tokenExpiryDate: any;
  message: string = '';
  private authStatusListener = new Subject<boolean>();
  private userSelected = new Subject<AuthData>();
  private tokenTimer: any;
  private user: any = null;
  private users: any[] = [];
  Email: string = '';

  usersUpdated = new Subject<{ users: any[] }>();

  sendUsers() {
    return this.usersUpdated.asObservable();
  }

  constructor(private http: HttpClient, private router: Router, private activatedRoute: ActivatedRoute) { }

  currentUser(userInfo: any) {
    this.user = userInfo;
    this.userSelected.next(userInfo);
  }

  getCurrentUser() {
    return this.userSelected.asObservable();
  }

  getAuthStatusListner() {
    return this.authStatusListener.asObservable();
  }

  getIsAuth() {
    return this.isAuthenticated;
  }

  getUserInfo() {
    return this.user;
  }


  createUser(name: string, phone: string, email: string, password: string) {
    const authData: AuthData = {
      name: name,
      phone: phone,
      email: email,
      password: password
    }
    this.http.post<{ user: any, token: string, expiresIn: number }>(BACKEND_URL + "register", authData).subscribe(response => {
      const token = response.token;
      this.user = response.user;
      this.token = response.token;
      if (token) {
        const expiresInDuration = response.expiresIn;
        this.setAuthTimer(expiresInDuration);
        this.isAuthenticated = true;
        this.authStatusListener.next(true);
        const now = new Date();
        const expirationDate = new Date(now.getTime() + expiresInDuration * 1000);
        this.saveAuthData(token, expirationDate, this.user);
        window.alert('Registration Successfull!')
        this.router.navigate(['/main']);
      }
    }, error => {
        if (error.error.msg == "Email already enrolled") {
          this.router.navigate(['login']);
          window.alert(error.error.msg)
        } else {
          window.alert(error.error.msg)
          this.router.navigate(['login']);
        }
        
    });
  }

  getUser() {
    return this.user.name;
  }

  login(email: string, password: string) {
    const authData = {
      email: email,
      password: password
    }
    this.http.post<{ user: any, token: string, expiresIn: number }>(BACKEND_URL + "login", authData).subscribe(response => {
      //console.log(response);
      const token = response.token;
      this.token = token;
      this.user = response.user;

      if (token) {
        const expiresInDuration = response.expiresIn;
        this.setAuthTimer(expiresInDuration);
        this.isAuthenticated = true;
        this.authStatusListener.next(true);
        const now = new Date();
        const expirationDate = new Date(now.getTime() + expiresInDuration * 1000);
        this.tokenExpiryDate = expirationDate;
        this.saveAuthData(token, expirationDate, response.user);
        this.router.navigate(['main'])
      }
    }, error => {
      //console.log(error);
      window.alert(error.error.msg)
      this.router.navigate(['register']);
    });
  }

  getToken() {
    return this.token;
  }

  getUsers(usersPerPage?: number, currentPage?: number, selected?: string, selectedOption?: string) {
    const queryParams = `?limit=${usersPerPage}&skip=${currentPage}&sortBy=${selected}:${selectedOption}`;
    this.http.get<{users: any[] }>(BACKEND_URL + "users").pipe(map(usersData => {
      return {
        users: usersData.users.map(user => {
          var name = user.name;
          var phone = user.phone;
          var email = user.email;
          var createdAt = user.createdAt;
          
          let userInfo = {
            name: name,
            phone: phone,
            email: email,
            createdAt: createdAt,
          }
          
          return userInfo;
        })
      };
    })).subscribe(response => {
      //console.log(response);
      this.users = response.users;
      this.usersUpdated.next({ users: [...this.users]});
    }, error => {
        this.router.navigate(['register']);
    });

    return { users: [...this.users] };
  }

  logout() {
    this.http.post(BACKEND_URL + "users/logout", this.token).subscribe(response => {
      this.token = '';
      this.isAuthenticated = false;
      this.authStatusListener.next(false);
      clearTimeout(this.tokenTimer);
      this.clearAuthData();
      this.router.navigate(['login']);
    }, error => {
        this.onLogoutall();
        this.router.navigate(['login']);
    });
  }

  onLogoutall() {
    this.http.post(BACKEND_URL + "users/logoutall", this.token).subscribe(response => {
      this.token = '';
      this.isAuthenticated = false;
      this.authStatusListener.next(false);
      clearTimeout(this.tokenTimer);
      this.clearAuthData();
      this.router.navigate(['login']);
    });
  }

  autoAuthUser() {
    const authInformation: any = this.getAuthData();
    if (!authInformation) {
      return;
    }
    const now = new Date();
    const expiresIn = authInformation.expirationDate.getTime() - now.getTime();
    if (expiresIn > 0) {
      this.token = authInformation.token;
      this.user = JSON.parse(authInformation.user);
      this.isAuthenticated = true;
      this.setAuthTimer(expiresIn / 1000);
      this.authStatusListener.next(true);
    }
  }


  private setAuthTimer(duration: number) {
    //console.log("Setting timer: " + duration);
    this.tokenTimer = setTimeout(() => {
      this.logout();
    }, duration * 1000);
  }

  private saveAuthData(token: string, expirationDate: Date, user: any) {
    //console.log(expirationDate);
    localStorage.setItem("token", token);
    localStorage.setItem("expiration", expirationDate.toISOString());
    localStorage.setItem("user", JSON.stringify(user));
  }

  private clearAuthData() {
    localStorage.removeItem("token");
    localStorage.removeItem("expiration");
    localStorage.removeItem("user");
  }

  private getAuthData() {
    const token = localStorage.getItem("token");
    const expirationDate = localStorage.getItem("expiration");
    const user = localStorage.getItem("user");
    if (!token || !expirationDate) {
      return;
    }
    return {
      token: token,
      expirationDate: new Date(expirationDate),
      user: user
    }
  }
}
