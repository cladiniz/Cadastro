<?php

include('config.inc.php');

session_start();

class DB{

	var $config = [];
	var $error = FALSE;
	var $error_data = [NULL, NULL];
	var $query_txt = '';
	var $socket = NULL;
	var $sth;
	
	public function __construct($config_tmp = NULL){

		global $config_db;	

		//  Testa arquivo de configuração e sessão
		if (!in_array(NULL, $config_db)){
			$this -> config = $config_db;			
		}elseif (isset($_SESSION['config_db'])){
			$this -> config = $_SESSION['config_db'];
		}elseif ($config_tmp){
			$this -> config = $config_tmp;
		}else{
			$this -> error_set('no_config', 'Nenhuma configuração disponível');
		}

		//  Tenta conectar se não existe error
		if (!$this -> error){
			$this -> connect();
		}
		
	}

	private function error_set($cod, $mes = NULL){

		$this -> error = TRUE;
		$this -> error_data = [$cod, is_array($mes) ? join(' - ', $mes) : $mes];
		return FALSE;

	}

	public function execute($args = array()){

		$op = $this -> sth -> execute($args);
		$error_code = $this -> sth -> errorCode();

		if ($error_code != '00000'){
            $this -> error_set($error_code, $this -> sth -> errorInfo());
		}else{

			switch (strtoupper (substr ($this -> query_txt, 0, 6))){
				
			case 'DELETE':
				return $this -> sth -> rowCount();
				break;

			case 'INSERT':
				$this -> rows = $this -> sth -> rowCount();
				return $this -> socket -> lastInsertId();
				break;
					
			case 'SELECT':
				return $this -> sth -> fetchAll(PDO::FETCH_ASSOC);
				break;

			case 'UPDATE':
				return $this -> sth -> rowCount();
				break;

			}

		}

	}

	public function prepare($query){

		$this -> query_txt = $query;

		try {
            $this -> sth = $this -> socket -> prepare($query);
		}catch (PDOException $error){
            $this -> error_set('prepare', $error -> getMessage());
		}

	}

	public function query($query, $args = array()){

		$this -> prepare($query);		
		return $this -> execute($args);		

	}

	private function connect(){

		try{
			
			$this -> socket = new PDO(
				sprintf('mysql:host=%s;port=%d;', $this -> config['host'], $this -> config['port']), 
				$this -> config['user'], 
				$this -> config['pass'],
				array(PDO::MYSQL_ATTR_FOUND_ROWS => TRUE)
			);

			return TRUE;

		}catch (PDOException $error){			
			return $this -> error_set($error -> getCode(), $error -> getMessage());
		}
		
	}

}
?>
